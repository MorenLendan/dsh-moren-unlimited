#!/usr/bin/env bash
# Publish this repository to GitHub as a PUBLIC repository and push main.
#
# Requirements:
#   GITHUB_USER  your account or org
#   GITHUB_TOKEN a token with `repo` (classic) or Repositories: Read and write
#   REPO         optional, default dsh-moren-unlimited
#
# Usage:
#   GITHUB_USER=yourname GITHUB_TOKEN=ghp_xxx ./scripts/publish-github.sh
#
# Or use the GitHub CLI instead:
#   gh repo create dsh-moren-unlimited --public --source=. --remote=origin --push
set -euo pipefail

: "${GITHUB_USER:?set GITHUB_USER}"
: "${GITHUB_TOKEN:?set GITHUB_TOKEN}"
REPO="${REPO:-dsh-moren-unlimited}"
API="https://api.github.com"

echo "[moren] creating public repo ${GITHUB_USER}/${REPO} (if missing)"
status=$(curl -sS -o /tmp/moren-gh-create.json -w '%{http_code}' \
  -X POST "${API}/user/repos" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"${REPO}\",\"private\":false,\"description\":\"Moren unrestricted LiangShen mode for DSH: purge unrestricted + unrestricted subagents + LiangShen, with media, codec, token guard, REA MCP and intel.\",\"has_issues\":true,\"has_wiki\":false}")
if [ "$status" = "201" ]; then
  echo "[moren] repo created"
elif [ "$status" = "422" ]; then
  echo "[moren] repo already exists — ensuring it is public"
  curl -sS -X PATCH "${API}/repos/${GITHUB_USER}/${REPO}" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -d '{"private":false}' >/dev/null
else
  echo "[moren] create failed (HTTP ${status}):"
  cat /tmp/moren-gh-create.json
  exit 1
fi

echo "[moren] pushing main"
git push "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO}.git" main
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${GITHUB_USER}/${REPO}.git"
git branch --set-upstream-to=origin/main main 2>/dev/null || true

echo "[moren] done: https://github.com/${GITHUB_USER}/${REPO}"
