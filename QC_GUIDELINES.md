# LabMate Recipe QC Guidelines

This document defines the quality standards every recipe in `recipes/` must meet before it can be published (pushed to GitHub → fetched by the LabMate web app). Two tools enforce these:

| Tool | Scope | Speed | When to run |
| --- | --- | --- | --- |
| `node qc.js` | Mechanical checks (field presence, format, schema) | Fast (seconds) | Every commit / pre-push |
| `node qc-llm.js <id>` | Semantic review (references, science, translation) | Slow (minutes per recipe) | New recipes before first publish; periodic audits |

The mechanical check is the gate. The LLM check is the safety net.

---

## 1. Required fields (BLOCKER if missing)

Every recipe, regardless of category, must have:

- `id` — snake_case, matches filename exactly (no leading numbers, no spaces)
- `name` — full English name
- `nameCn` — full Chinese name
- `category` — one of: `buffer`, `protocol`, `media`, `staining`
- `components` — non-empty array

If any of these is missing → **BLOCKER**. Recipe must not be published.

## 2. Bilingual coverage (BLOCKER for users, MAJOR for maintainers)

All text fields that face the user **must** be in both `en` and `zh`:

- `name` / `nameCn`
- `usage.{en, zh}` (if `usage` exists)
- `notes.{en, zh}` (if `notes` exists)
- `materials[].note.{en, zh}` (if `note` exists)
- `components[].note.{en, zh}` (if `note` exists)
- `safeStops[].note.{en, zh}` (if `note` exists)
- `storage.label.{en, zh}` (if `label` exists)
- `prepSteps[].{en, zh}` (if `prepSteps` exists)
- `detailedSteps[].{en, zh}` (if `detailedSteps` exists)
- `briefSteps[].{en, zh}` (if `briefSteps` exists)

Strings instead of `{en, zh}` objects are flagged. Half-translated objects (only one language) are flagged.

## 3. Reference integrity (BLOCKER if wrong)

This is the most common failure mode. Every recipe with a `ref` and/or `doi` MUST have **real, verifiable references**.

**Acceptable references:**
- DOI: format `10.xxxx/yyyy` — must resolve on doi.org
- PMID: integer — must resolve on pubmed.ncbi.nlm.nih.gov
- Author-year citation to a real publication (book, paper, well-known protocol)
- URLs to authoritative sources (Cold Spring Harbor Protocols, Addgene, manufacturer docs)

**Not acceptable:**
- ❌ DOI that returns 404 on doi.org
- ❌ DOI that resolves to a different paper than cited
- ❌ Author-year citations to papers that don't exist
- ❌ Generic citations like "manufacturer's instructions" without naming the manufacturer
- ❌ "Standard protocol" with no actual source
- ❌ Citations that name a paper but list an unrelated DOI

If a reference cannot be verified, **remove it** rather than ship an unverifiable claim.

## 4. Protocol-specific requirements

A recipe with `category: "protocol"` must additionally have:

- **Step structure** — EITHER `components[]` with `unit: "step"` entries OR `detailedSteps[]` (preferably both — `components` for the table view, `detailedSteps` for the rich step-by-step view with timer/temp)
- **Per-step metadata** (recommended) — `detailedSteps[].time` (e.g. `"5 min"`, `"1 h"`, `"overnight"`) and `detailedSteps[].temp` (e.g. `"RT"`, `"4°C"`, `"37°C"`) for every non-header step
- **Section dividers** (recommended) — `detailedSteps[]` entries with `isHeader: true` to group steps into logical phases (e.g. "**Day 1 — Preparation**")
- **`briefSteps[]`** — one-liner TL;DR for at-a-glance reading
- **`safeStops[]`** — at least one for any multi-day or >4 h protocol
- **`materials[]`** — every reagent/equipment the user needs
- **`duration.{total, hands_on}`** — the user wants to know the time commitment
- **`ref` + `doi`** — see §3
- **`discipline[]`** — at least one (e.g. `["cell", "protein"]`)
- **`crosslinks[]` or `relatedProtocols[]`** — link to related recipes (lentivirus production ↔ lentivirus concentration ↔ titer)

## 5. Buffer/Media/Staining requirements

A recipe with `category` in `["buffer", "media", "staining"]` must have:

- **`storage.{temperature, duration}`** — where and how long it's stable
- **`volume` + `volumeUnit`** — default preparation volume
- **`components[]`** — every reagent with `amount` (number) and `unit` (string)
- For buffers: **`prepSteps[]`** — the user needs to know HOW to make it
- DOI/ref is **strongly recommended** but not strictly required for very common buffers (PBS, TBS, etc.) — even then, a Cold Spring Harbor Protocols or Sambrook citation adds credibility

## 6. Style and formatting

- **IDs are snake_case** — `cell_passage`, not `cellPassage` or `Cell-Passage`
- **IDs match filenames** — file `pbs_10x.json` must have `id: "pbs_10x"`
- **DOIs are bare** — `10.1038/nprot.2006.37`, not `https://doi.org/10.1038/nprot.2006.37`
- **Units are SI** — `g`, `mg`, `µg`, `mL`, `µL`, `M`, `mM`, `µM`, `nM`, `°C`
- **Use en-dash for ranges** — `"5–10 min"`, `"4–6 h"`, not `"5-10 min"`
- **No personal info** — no lab member names, no room numbers, no internal URLs
- **No fabricated content** — if you don't know a number, look it up; don't invent

## 7. LLM review checklist (for `qc-llm.js` sub-agents)

When invoking the LLM reviewer, the sub-agent must check:

1. **Reference realism** — fetch each DOI; confirm the cited paper actually says what the recipe claims
2. **Scientific accuracy** — are times, temperatures, concentrations reasonable? Are critical safety warnings present?
3. **Bilingual quality** — does the Chinese translation preserve technical meaning? Are enzyme names, gene names, and units rendered consistently with the rest of the library?
4. **Completeness** — are there obvious missing steps (e.g., "centrifuge" without specifying speed/time)?
5. **Cross-link integrity** — do `linkedRecipe` / `relatedProtocols` / `crosslinks` IDs actually exist in `recipes/`?

The sub-agent returns a JSON verdict: `PASS`, `PASS_WITH_NOTES`, or `FAIL`. Recipes with verdict `FAIL` or any `BLOCKER` issues must not be published.

## 8. Pre-publish workflow

```
# 1. Mechanical check (fast — runs in seconds)
node qc.js                       # all recipes
node qc.js new_protocol          # just the new one

# 2. Semantic review (slow — minutes per recipe, for new/changed recipes)
node qc-llm.js new_protocol      # review one
node qc-llm.js --staged          # review all staged changes
node qc-llm.js --last-commit     # review what was just committed

# 3. Build the dist
node merge-recipes.js

# 4. Push to GitHub (if all green)
git add -A && git commit -m "..." && git push origin main
```

If step 1 reports errors, fix them before step 2. If step 2 reports `BLOCKER` issues, do not push.

## 9. Adding new recipes

1. Copy the appropriate template from `templates/`
2. Fill in all required fields per the relevant section above
3. Run `node qc.js <new-id>` — must pass with zero errors
4. Run `node qc-llm.js <new-id>` — must return `PASS` or `PASS_WITH_NOTES`
5. Address any `BLOCKER` or `MAJOR` issues from the LLM review
6. Commit and push

## 10. Periodic audit

Every ~6 months, run `node qc-llm.js --all` against the entire library. This catches:
- Newly retracted papers (rare but happens)
- Outdated best practices
- Translation drift

Audit reports are stored as `qc-audit-YYYY-MM-DD.md` in the repo root.
