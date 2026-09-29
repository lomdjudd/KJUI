"""Point d'entrée stable : utilisé par les hooks/MCP de Claude (chemin qui ne change pas entre les mises à jour)."""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from kjui.cli import main  # noqa: E402

raise SystemExit(main())
