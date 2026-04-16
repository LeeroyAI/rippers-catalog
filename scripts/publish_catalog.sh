#!/usr/bin/env bash
# publish_catalog.sh
#
# Regenerates catalog.json from dashboard.html and pushes it to the
# rippers-catalog GitHub repo so the live in-app feed is updated.
#
# Prerequisites:
#   - dashboard.html present in repo root (or pass --source <path>)
#   - GitHub repo LeeroyAI/rippers-catalog cloned at ../rippers-catalog
#     (or set CATALOG_REPO_PATH env var to override)
#   - git configured with push access to that repo
#
# Usage:
#   ./scripts/publish_catalog.sh
#   ./scripts/publish_catalog.sh --source /path/to/dashboard.html

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CATALOG_REPO="${CATALOG_REPO_PATH:-$REPO_ROOT/../rippers-catalog}"

# ---------------------------------------------------------------------------
# 1. Regenerate Swift data files + catalog.json from dashboard.html
# ---------------------------------------------------------------------------
echo "→ Importing dashboard data..."
node "$SCRIPT_DIR/import_dashboard_data.js" "$@"

# ---------------------------------------------------------------------------
# 2. Copy catalog.json to the catalog repo
# ---------------------------------------------------------------------------
if [ ! -d "$CATALOG_REPO" ]; then
  echo ""
  echo "Catalog repo not found at: $CATALOG_REPO"
  echo ""
  echo "To set up:"
  echo "  1. Create GitHub repo: LeeroyAI/rippers-catalog"
  echo "  2. Clone it next to this repo:"
  echo "     cd .. && git clone https://github.com/LeeroyAI/rippers-catalog.git"
  echo "  3. Run this script again."
  echo ""
  echo "catalog.json has been updated locally (bundled in app)."
  exit 0
fi

echo "→ Copying catalog.json to $CATALOG_REPO..."
cp "$REPO_ROOT/Rippers/catalog.json" "$CATALOG_REPO/catalog.json"

# ---------------------------------------------------------------------------
# 3. Commit and push
# ---------------------------------------------------------------------------
cd "$CATALOG_REPO"
git add catalog.json
if git diff --cached --quiet; then
  echo "→ No changes to publish (catalog.json unchanged)."
  exit 0
fi

TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')
git commit -m "Update catalog — $TIMESTAMP"
git push origin main

echo ""
echo "✓ catalog.json published."
echo "  Live URL: https://raw.githubusercontent.com/LeeroyAI/rippers-catalog/main/catalog.json"
echo ""
echo "If useLiveCatalog is still false in CatalogFeatureFlags.swift, flip it to true."
