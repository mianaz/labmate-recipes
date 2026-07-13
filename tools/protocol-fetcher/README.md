# protocol-fetcher

Periodic scan of [protocols.io](https://www.protocols.io) for popular protocols worth
adding to LabMate. It **only proposes candidates** — it never touches the recipe library.
Pair it with the `labmate-recipe` skill, which turns a chosen candidate into a
schema-valid recipe JSON.

## What it does

1. Reads a curated list of search terms (`terms.json`).
2. For each term, pulls the top-viewed public protocols from the protocols.io v3 API.
3. Dedups every hit against the ~227 recipes already in `recipes/**.json`
   (DOI match, then Jaccard token overlap on the title/nameCn).
4. Writes a dated report to `out/`:
   - `candidates-YYYY-MM-DD.json` — full machine-readable list
   - `candidates-YYYY-MM-DD.md` — human review report, grouped `NEW` / `REVIEW` / `LIKELY-DUP`, sorted by views

`out/` is git-ignored.

## Usage

```bash
node fetch-candidates.js                  # all terms in terms.json, top-8 each
node fetch-candidates.js --per 5          # top-5 per term
node fetch-candidates.js --min-views 500  # ignore low-traffic protocols
node fetch-candidates.js --term "ChIP-seq" --term "spatial"   # ad-hoc terms only
./run.sh                                  # same, plus a one-paragraph summary for cron
```

### Dedup verdicts

| verdict | meaning |
|---------|---------|
| `new` | no close match in the library (title overlap < 0.35) |
| `review` | partial title overlap (0.35–0.6) — eyeball it |
| `likely-dup` | DOI already present, or title overlap ≥ 0.6 |

Thresholds live at the top of `classify()` in `fetch-candidates.js`. Tune if it's
too eager or too shy.

## Auth

Reads `client_access_token` from
`~/.openclaw/workspace-webdev/secrets/protocols-io.json` (override with the
`PROTOCOLS_IO_SECRET` env var). This is the protocols.io **v3** API — v4 has a
different required-param schema.

## Scheduling (weekly)

Not yet registered — pick one path:

**A. openclaw cron (preferred — delivers the summary to Discord).** Register via the
OpenClaw agent (Marion) or the `cron` tool with an isolated `agentTurn` that runs
`run.sh` and relays its stdout. Suggested: Mondays 09:00. The health-checker cron is
the existing template to copy.

**B. system crontab (self-contained, emails output via MAILTO).**

```cron
# LabMate: weekly protocols.io candidate scan — Mondays 09:00
0 9 * * 1 cd /home/ubuntu/.openclaw/workspace-webdev/labmate-recipes/tools/protocol-fetcher && ./run.sh >> out/cron.log 2>&1
```

The wrapper exits non-zero on failure so either scheduler surfaces errors.
