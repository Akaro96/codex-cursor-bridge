#!/usr/bin/env bash
# Requires a running bridge. For dry runs, start it with CODEX_CURSOR_BRIDGE_MOCK=1.
# On Windows, run from Git Bash/WSL or translate the curl calls to PowerShell's Invoke-RestMethod.
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:48124}"

curl -fsS "$BASE/health"
printf '\n--- models ---\n'
curl -fsS "$BASE/v1/models"
printf '\n--- response ---\n'
curl -fsS "$BASE/v1/responses" \
  -H 'content-type: application/json' \
  -d '{"model":"cursor-auto","input":"Reply with exactly OK.","reasoning":{"effort":"medium"}}'
printf '\n'
