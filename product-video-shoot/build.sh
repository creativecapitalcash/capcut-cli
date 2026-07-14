#!/usr/bin/env bash
set -euo pipefail

# ── Product Video Builder ──────────────────────────────────────────
# Swap in your own footage and text, then run this script.
#
# Usage:
#   ./build.sh                      # build with defaults
#   ./build.sh --render             # build + render MP4 preview
#   ./build.sh --render --preview   # build + render + open preview
#
# To customize: edit spec.json directly, or override via env vars:
#   PRODUCT_NAME="My Product" HOOK_TEXT="You won't believe this" ./build.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node ${SCRIPT_DIR}/../dist/index.js"
SPEC="${SCRIPT_DIR}/spec.json"
DRAFT="${SCRIPT_DIR}/draft"
PREVIEW="${SCRIPT_DIR}/preview.mp4"

# Clean previous build
rm -rf "$DRAFT"

# Compile the spec into a CapCut draft
echo "Compiling product video draft..."
$CLI compile "$SPEC" --out "$DRAFT"

# Show timeline
echo ""
echo "Timeline:"
$CLI timeline "$DRAFT" -H

# Optional: render preview
if [[ "${1:-}" == "--render" || "${2:-}" == "--render" ]]; then
  echo ""
  echo "Rendering preview..."
  $CLI render "$DRAFT" --out "$PREVIEW"
  echo "Preview saved: $PREVIEW"
fi

echo ""
echo "Draft ready at: $DRAFT"
echo "Open this folder in CapCut to edit and render the final video."
