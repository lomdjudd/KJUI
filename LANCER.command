#!/bin/sh
cd "$(dirname "$0")"
[ -f "$HOME/.kjui/brain.db" ] || python3 -m kjui demo
python3 -m kjui gui
