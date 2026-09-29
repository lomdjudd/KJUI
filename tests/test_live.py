import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

from kjui import connect as cn
from kjui.hook import run as hook_run
from kjui.ingest import ingest_conversations, ingest_transcript
from kjui.recall import recall
from kjui.store import Brain


class LiveTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.brain = Brain(self.dir / "b.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_events_conversations_files(self):
        t = self.dir / "sess.jsonl"
        lines = [
            {"type": "user", "message": {"content": "bonjour cerveau"}},
            {"type": "assistant", "message": {"content": [
                {"type": "text", "text": "salut"},
                {"type": "tool_use", "name": "Write", "input": {"file_path": "/x/a.html", "content": "<p>hello</p>"}}]}},
        ]
        t.write_text("\n".join(map(json.dumps, lines)) + "\n")
        ingest_transcript(self.brain, t, 0)
        evs = self.brain.events(0, 50)
        self.assertGreaterEqual(len([e for e in evs if e["type"] == "add"]), 3)
        convs = self.brain.conversations()
        self.assertEqual(len(convs), 1)
        self.assertEqual(convs[0]["conv"], "sess")
        self.assertEqual(convs[0]["app"], "Claude Code")
        self.assertEqual(convs[0]["first_q"], "Toi : bonjour cerveau")
        self.assertEqual(convs[0]["files"], 1)
        msgs = self.brain.conversation("sess")
        self.assertEqual([m["kind"] for m in msgs], ["conversation", "conversation", "file"])
        self.assertEqual(self.brain.files()[0]["title"].startswith("a.html"), True)
        after = self.brain.events(evs[-1]["id"])
        self.assertEqual(after, [])

    def test_claude_ai_conversation_grouped(self):
        ingest_conversations(self.brain, [{"uuid": "u9", "name": "Ma conv", "chat_messages": [
            {"sender": "human", "text": "hello"}, {"sender": "assistant", "text": "hi"}]}])
        c = self.brain.conversations()[0]
        self.assertEqual((c["conv"], c["app"], c["conv_title"], c["n"]), ("u9", "claude.ai", "Ma conv", 2))

    def test_recall_logged_and_hook(self):
        self.brain.add("Le port du serveur est 8765 et se règle avec --port", title="Port du serveur")
        with mock.patch("sys.stdin", io.StringIO(json.dumps({"prompt": "quel est le port du serveur ?", "session_id": "s"}))):
            buf = io.StringIO()
            with redirect_stdout(buf):
                hook_run("prompt", self.brain)
        out = json.loads(buf.getvalue())
        self.assertIn("8765", out["hookSpecificOutput"]["additionalContext"])
        ev = [e for e in self.brain.events(0, 50) if e["type"] == "recall"][-1]
        self.assertEqual(ev["data"]["via"], "hook")
        self.assertGreater(self.brain.last_claude_call(), 0)
        # hors sujet : rien injecté
        with mock.patch("sys.stdin", io.StringIO(json.dumps({"prompt": "écris un poème sur les chats", "session_id": "s"}))):
            buf = io.StringIO()
            with redirect_stdout(buf):
                hook_run("prompt", self.brain)
        self.assertEqual(buf.getvalue(), "")
        # la session courante n'est pas re-servie à elle-même
        with brain_ctx(self.brain, "cur"):
            self.brain.add("port du serveur secret 9999 dans la session courante", title="courant")
        r = recall(self.brain, "port serveur 9999", exclude_conv="cur")
        self.assertNotIn("9999", r["pack"])

    def test_connect_disconnect_preserves_user_config(self):
        home = self.dir / "home"
        (home / ".claude").mkdir(parents=True)
        (home / ".claude" / "settings.json").write_text(json.dumps({"theme": "dark", "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "echo hi"}]}]}}))
        (home / ".claude.json").write_text(json.dumps({"numStartups": 3, "mcpServers": {"autre": {"command": "x"}}}))
        with mock.patch.dict(os.environ, {"HOME": str(home), "USERPROFILE": str(home)}), mock.patch("pathlib.Path.home", return_value=home):
            st = cn.apply(True)
            self.assertTrue(st["connected"] and st["claude_md"])
            s = json.loads((home / ".claude" / "settings.json").read_text())
            self.assertIn("Stop", s["hooks"])  # hook existant conservé
            self.assertIn("UserPromptSubmit", s["hooks"])
            j = json.loads((home / ".claude.json").read_text())
            self.assertIn("autre", j["mcpServers"])
            self.assertIn("kjui", j["mcpServers"])
            cn.apply(True)  # idempotent
            s = json.loads((home / ".claude" / "settings.json").read_text())
            self.assertEqual(len(s["hooks"]["UserPromptSubmit"]), 1)
            st = cn.apply(False)
            self.assertFalse(st["connected"])
            s = json.loads((home / ".claude" / "settings.json").read_text())
            self.assertEqual(s, {"theme": "dark", "hooks": {"Stop": [{"hooks": [{"type": "command", "command": "echo hi"}]}]}})
            self.assertEqual(json.loads((home / ".claude.json").read_text()), {"numStartups": 3, "mcpServers": {"autre": {"command": "x"}}})


def brain_ctx(brain, conv):
    return brain.ctx(conv=conv, app="test")


if __name__ == "__main__":
    unittest.main()
