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

    def test_claude_export_and_transcript(self):
        p = Path(self.tmp.name) / "conversations.json"
        p.write_text(json.dumps([{"uuid": "u1", "name": "Chat", "chat_messages": [
            {"sender": "human", "text": "Comment lancer les tests ?"},
            {"sender": "assistant", "text": "Utilise pytest -q."}]}]))
        self.assertEqual(ingest_claude_export(self.brain, p), 1)
        t = Path(self.tmp.name) / "s.jsonl"
        lines = [
            {"type": "user", "message": {"content": "Quel port pour le serveur ?"}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Le port 8765."}]}},
        ]
        t.write_text("\n".join(map(json.dumps, lines)) + "\n")
        n, off = ingest_transcript(self.brain, t, 0)
        self.assertEqual(n, 1)
        # relecture depuis l'offset : pas de doublon
        ingest_transcript(self.brain, t, off)
        self.assertEqual(len(self.brain.search("port serveur")), 1)


if __name__ == "__main__":
    unittest.main()
