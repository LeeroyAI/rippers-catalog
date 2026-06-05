#!/bin/bash
# Soft-warning hook: scan recently-edited markdown for em-dashes.
# The root CLAUDE.md hard rule: no em-dashes anywhere.
# This hook does not block. It warns Claude to fix em-dashes before completing the task.

set -e

ROOT="$CLAUDE_PROJECT_DIR"
if [ -z "$ROOT" ]; then
  echo '{}'
  exit 0
fi

# Look for em-dashes (Unicode em-dash) in tracked markdown files modified in the last 5 minutes.
FOUND=$(find "$ROOT" -name "*.md" -mmin -5 -type f 2>/dev/null | head -20 | while read -r f; do
  if grep -Pl "[\xe2\x80\x94]" "$f" 2>/dev/null; then
    echo "$f"
  fi
done | head -10)

if [ -n "$FOUND" ]; then
  cat >&2 <<MSG
WARN: em-dashes found in recently-edited markdown files. The hard rule in CLAUDE.md says no em-dashes anywhere. Replace with commas, colons, semicolons, or periods.

Files:
$FOUND

This is a soft warning. Fix before declaring the task complete.
MSG
fi

echo '{}'
exit 0
