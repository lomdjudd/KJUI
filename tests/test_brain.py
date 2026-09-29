import json
import tempfile
import unittest
from pathlib import Path

from kjui.ingest import chunk_markdown, ingest_claude_export, ingest_markdown, ingest_transcript
from kjui.recall import recall
from kjui.store import Brain


class BrainTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.brain = Brain(Path(self.tmp.name) / "b.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_add_dedupe_and_search(self):
        a, new = self.brain.add("Le projet utilise pnpm et Node 22", title="Stack")
        b, new2 = self.brain.add("Le projet utilise pnpm et Node 22", title="Stack")
        self.assertTrue(new)
        self.assertFalse(new2)
        self.assertEqual(a, b)
        self.assertEqual(self.brain.search("pnpm")[0]["id"], a)
        self.assertEqual(self.brain.search("déployer kubernetes"), [])

    def test_key_upsert_updates_fts(self):
        i, _ = self.brain.add("ancien texte zébra", key="k1")
        j, new = self.brain.add("nouveau texte lion", key="k1")
        self.assertEqual(i, j)
        self.assertFalse(new)
        self.assertEqual(self.brain.search("lion")[0]["id"], i)
        self.assertEqual(self.brain.search("zebra"), [])  # accents ignorés, ancien contenu retiré

    def test_forget(self):
        i, _ = self.brain.add("secret temporaire")
        self.assertTrue(self.brain.forget(i))
        self.assertEqual(self.brain.search("secret"), [])

    def test_markdown_chunks_and_pinned_instruction(self):
        md = "---\nkind: instruction\npinned: true\n---\n# Règles\nSois bref.\n"
        ingest_markdown(self.brain, md, "regles.md")
        self.assertEqual(len(self.brain.pinned()), 1)
        long = "# A\n" + "\n\n".join("paragraphe " + "mot " * 80 for _ in range(10)) + "\n# B\ncourt"
        chunks = chunk_markdown(long, "doc")
        self.assertGreater(len(chunks), 3)
        self.assertTrue(all(len(c[1]) < 1700 for c in chunks))

    def test_recall_budget_and_savings(self):
        big = "# Doc\n" + "\n\n".join(f"## Sujet{i}\n" + f"contenu sujet{i} " * 120 for i in range(8))
        ingest_markdown(self.brain, big, "big.md")
        out = recall(self.brain, "sujet3", budget=300)
        self.assertLessEqual(out["tokens"], 340)
        self.assertGreater(out["saved"], 0)
        self.assertIn("Sujet3", out["pack"])
        self.assertEqual(self.brain.stats()["recalls"], 1)

    def test_claude_export_messages_and_attachments(self):
        p = Path(self.tmp.name) / "conversations.json"
        p.write_text(json.dumps([{"uuid": "u1", "name": "Chat", "chat_messages": [
            {"sender": "human", "text": "Comment lancer les tests ?",
             "attachments": [{"file_name": "notes.txt", "extracted_content": "contenu joint zorglub"}],
             "files": [{"file_name": "photo.png"}]},
            {"sender": "assistant", "text": "Utilise pytest -q.", "content": [
                {"type": "text", "text": "Utilise pytest -q."},
                {"type": "tool_use", "name": "artifacts", "input": {"title": "Script", "content": "print('salut')"}}]}]}]))
        self.assertEqual(ingest_claude_export(self.brain, p), 5)
        self.assertEqual(ingest_claude_export(self.brain, p), 0)  # idempotent
        self.assertEqual(self.brain.search("zorglub")[0]["kind"], "file")

    def test_transcript_every_message_image_and_written_file(self):
        import base64

        png = base64.b64encode(b"\x89PNG fake").decode()
        t = Path(self.tmp.name) / "s.jsonl"
        lines = [
            {"type": "user", "message": {"content": "Quel port pour le serveur ?"}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Le port 8765."}]}},
            {"type": "user", "message": {"content": [
                {"type": "text", "text": "voici la capture du bug"},
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": png}}]}},
            {"type": "assistant", "message": {"content": [
                {"type": "tool_use", "name": "Write", "input": {"file_path": "/x/app.py", "content": "print('hello licorne')"}}]}},
            {"type": "user", "isMeta": True, "message": {"content": "ignoré"}},
        ]
        t.write_text("\n".join(map(json.dumps, lines)) + "\n")
        n, off = ingest_transcript(self.brain, t, 0)
        self.assertEqual(n, 5)  # 3 messages texte + 1 image + 1 fichier écrit
        img = self.brain.search("capture bug", kind="image")[0]
        self.assertTrue((self.brain.files_dir / img["blob"]).is_file())
        self.assertEqual(self.brain.search("licorne")[0]["kind"], "file")
        self.assertEqual(ingest_transcript(self.brain, t, off)[0], 0)  # rien de neuf
        # ligne à moitié écrite : on n'avance pas
        with t.open("ab") as f:
            f.write(b'{"type": "user", "message": {"content": "incompl')
        n2, off2 = ingest_transcript(self.brain, t, off)
        self.assertEqual((n2, off2), (0, off))

    def test_ingest_bytes_binary_and_text(self):
        from kjui.ingest import ingest_bytes

        ingest_bytes(self.brain, "doc.pdf", b"%PDF-1.4 fake")
        ingest_bytes(self.brain, "code.py", "# mon script\nprint('kiwi')".encode())
        self.assertEqual(self.brain.search("doc.pdf")[0]["mime"], "application/pdf")
        self.assertEqual(self.brain.search("kiwi")[0]["kind"], "file")


if __name__ == "__main__":
    unittest.main()
