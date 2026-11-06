#!/usr/bin/env bash
# Replace the local home path and username in saved run records, so the repo is portable and publishable.
# Usage: harness/redact-paths.sh <run-dir>...   (text files only; edits in place)
# "/Users/<name>" becomes "~", and any remaining "<name>" (e.g. in `ls -l` output or "-Users-<name>-" folder ids) becomes "user".
set -euo pipefail
NAME="$(basename "$HOME")"
for d in "$@"; do
  grep -rIl -e "$NAME" "$d" 2>/dev/null | while IFS= read -r f; do
    perl -pi -e "s#\Q$HOME\E#~#g; s#\Q$NAME\E#user#g" "$f"
  done
done
