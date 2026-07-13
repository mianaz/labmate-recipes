#!/usr/bin/env bash
# Weekly wrapper for the protocols.io candidate fetcher.
# Runs the fetch, then emits a one-paragraph summary on stdout that a cron
# delivery (openclaw cron → Discord, or a plain crontab MAILTO) can relay to
# Miana for review. Non-zero exit on failure so cron surfaces the error.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Prefer repo-local node; fall back to PATH.
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "node not found on PATH" >&2
  exit 1
fi

SUMMARY_JSON="$("$NODE_BIN" fetch-candidates.js "$@" 2>/tmp/protocol-fetcher.log)" || {
  echo "protocol-fetcher FAILED:" >&2
  tail -20 /tmp/protocol-fetcher.log >&2
  exit 1
}

DATE=$(echo "$SUMMARY_JSON"   | node -pe 'JSON.parse(require("fs").readFileSync(0)).date')
NEW=$(echo "$SUMMARY_JSON"    | node -pe 'JSON.parse(require("fs").readFileSync(0)).new')
REVIEW=$(echo "$SUMMARY_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0)).review')
UNIQUE=$(echo "$SUMMARY_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0)).unique')

echo "protocols.io scan ${DATE}: ${NEW} new candidate(s), ${REVIEW} to review, ${UNIQUE} scanned."
echo "Report: ${DIR}/out/candidates-${DATE}.md"
echo "Next: skim the NEW section, then hand a chosen protocol to the labmate-recipe skill."
