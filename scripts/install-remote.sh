#!/usr/bin/env bash
# One-command install from GitHub:
#
#   curl -fsSL https://raw.githubusercontent.com/MorenLendan/dsh-moren-unlimited/main/scripts/install-remote.sh | bash
#
# Optional:
#   MOREN_REPO=git@github.com:MorenLendan/dsh-moren-unlimited.git
#   MOREN_PLUGIN_DIR=$HOME/.dsh/plugins
#   ... | bash -s -- --profile web
set -euo pipefail

REPO_URL="${MOREN_REPO:-https://github.com/MorenLendan/dsh-moren-unlimited.git}"
BASE="${MOREN_PLUGIN_DIR:-$HOME/.dsh/plugins}"
DEST="$BASE/dsh-moren-unlimited"

echo "[moren] installing into $DEST"
mkdir -p "$BASE"

if [ -d "$DEST/.git" ]; then
  git -C "$DEST" pull --ff-only
else
  rm -rf "$DEST"
  git clone --depth 1 "$REPO_URL" "$DEST"
fi

exec node "$DEST/scripts/install.mjs" "$@"
