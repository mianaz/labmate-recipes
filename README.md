# LabMate Recipe Library

Open-source recipe and protocol library for [BioinfoSpace LabMate](https://apps.bioinfospace.com/labmate/).

## Structure

```
recipes/
  buffers/          # Buffer recipes (PBS, RIPA, etc.)
  protocols/        # Step-by-step protocols (WB, ChIP, etc.)
  staining/         # Staining solutions (Coomassie, silver, etc.)
  media/            # Culture media (LB, DMEM, etc.)
templates/          # JSON templates for each category
build-recipes.js    # Build script: individual JSONs → dist/recipes.json
merge-recipes.js    # Merge repo recipes with existing deployed data
dist/recipes.json   # Pre-built recipes.json for app sync
```

Each recipe is a single `.json` file. The `dist/recipes.json` is built by `merge-recipes.js` and consumed by LabMate's in-app sync feature.

## Quick Start

### Adding a new recipe

1. Copy the appropriate template from `templates/`:
   - `templates/buffer_template.json` — buffers, stock solutions, reagents
   - `templates/protocol_template.json` — step-by-step experimental protocols
   - `templates/media_template.json` — cell culture media
   - `templates/staining_template.json` — staining solutions
2. Fill in **all** required and recommended fields (see [Quality Checklist](#quality-checklist))
3. Save to the correct subfolder: `recipes/buffers/`, `recipes/protocols/`, etc.
4. Run `node merge-recipes.js` to rebuild `dist/recipes.json`
5. Run `node sync.js validate` to check schema compliance

### Building

```bash
node build-recipes.js                                    # Build from repo only
node merge-recipes.js --existing /path/to/deployed.json  # Merge repo + deployed
node sync.js validate                                    # Validate all files
```

---

## Recipe Schema (v2)

### Buffer / Media / Staining

```json
{
  "id": "pbs_10x",
  "name": "10× PBS",
  "nameCn": "10× 磷酸盐缓冲液",
  "category": "buffer",
  "discipline": ["cell", "protein"],
  "tags": ["common", "cell biology", "WB"],
  "usage": {
    "en": "10× concentrated phosphate-buffered saline stock.",
    "zh": "10× 浓缩磷酸盐缓冲液母液。"
  },
  "volume": 1000,
  "volumeUnit": "mL",
  "storage": {
    "temperature": "RT",
    "duration": "12 months",
    "sterile": "autoclave",
    "notes": "Dilute to 1× before use"
  },
  "components": [
    { "name": "NaCl", "amount": 80, "unit": "g", "mw": 58.44, "concentration": "1.37 M" },
    { "name": "KCl", "amount": 2, "unit": "g", "mw": 74.55 },
    { "name": "ddH₂O", "amount": null, "unit": "mL", "note": { "en": "To volume", "zh": "补至终体积" } }
  ],
  "prepSteps": [
    { "en": "Dissolve salts in 800 mL ddH₂O.", "zh": "将盐类溶解于 800 mL ddH₂O 中。" },
    { "en": "Adjust pH to 7.4 with HCl.", "zh": "用 HCl 调节 pH 至 7.4。" },
    { "en": "Bring to 1000 mL. Autoclave.", "zh": "补至 1000 mL。高压灭菌。" }
  ],
  "notes": { "en": "Tips...", "zh": "提示..." },
  "ref": "Sambrook & Russell (2001) Molecular Cloning",
  "doi": "10.1101/pdb.rec8247",
  "relatedProtocols": ["pbs_1x", "wb_protocol"]
}
```

### Protocol

```json
{
  "id": "wb_protocol",
  "name": "Western Blot Full Protocol",
  "nameCn": "Western Blot 完整流程",
  "category": "protocol",
  "discipline": ["protein", "cell"],
  "tags": ["WB", "protein detection"],
  "usage": {
    "en": "Detect specific proteins by SDS-PAGE, transfer, and immunodetection.",
    "zh": "Western blot：SDS-PAGE 分离、转膜、免疫检测。"
  },
  "duration": { "total": "1–2 days", "hands_on": "3–4 hours" },
  "materials": [
    { "name": "RIPA lysis buffer", "linkedRecipe": "ripa" },
    { "name": "PVDF membrane" },
    { "name": "Stripping buffer", "linkedRecipe": "strip_buffer", "optional": true }
  ],
  "components": [
    { "name": "1. Lyse cells in RIPA buffer", "amount": 1, "unit": "step", "note": { "en": "Keep on ice", "zh": "保持冰上操作" } },
    { "name": "2. BCA protein quantification", "amount": 1, "unit": "step", "note": { "en": "20–50 µg/lane", "zh": "每泳道 20–50 µg" } },
    { "name": "3. SDS-PAGE electrophoresis", "amount": 1, "unit": "step" }
  ],
  "safeStops": [
    {
      "afterStep": 2,
      "note": {
        "en": "Lysate can be stored at −80°C for months",
        "zh": "裂解液可 −80°C 保存数月"
      }
    },
    {
      "afterStep": 8,
      "note": {
        "en": "Membrane can be stored dry at RT for weeks",
        "zh": "膜可室温干燥保存数周"
      }
    }
  ],
  "detailedSteps": [
    { "en": "**Day 1 — Sample prep & SDS-PAGE**", "zh": "**第一天 — 样品制备和 SDS-PAGE**", "isHeader": true },
    { "en": "Lyse cells in RIPA buffer on ice for 30 min.", "zh": "用 RIPA 缓冲液在冰上裂解细胞 30 分钟。", "time": "30 min", "temp": "4°C" },
    { "en": "Centrifuge 14,000×g, 15 min, 4°C. Collect supernatant.", "zh": "4°C 14,000×g 离心 15 分钟，收集上清。", "time": "15 min", "temp": "4°C" },
    { "en": "**Day 2 — Transfer & Detection**", "zh": "**第二天 — 转膜和检测**", "isHeader": true },
    { "en": "Transfer to PVDF membrane at 100V for 1 hour.", "zh": "100V 转膜至 PVDF 膜，1 小时。", "time": "1 h", "temp": "4°C" }
  ],
  "briefSteps": [
    {
      "en": "Lyse → quantify → SDS-PAGE → transfer → block → primary Ab O/N → wash → secondary Ab 1h → wash → ECL detect",
      "zh": "裂解 → 定量 → SDS-PAGE → 转膜 → 封闭 → 一抗过夜 → 洗 → 二抗 1h → 洗 → ECL 检测"
    }
  ],
  "notes": { "en": "Tips...", "zh": "提示..." },
  "ref": "Mahmood & Yang (2012) N Am J Med Sci 4:429–434",
  "doi": "10.4103/1947-2714.100998",
  "relatedProtocols": ["bca_protein_assay", "coomassie_staining", "immunoprecipitation"],
  "storage": {
    "temp": "N/A",
    "duration": "1–2 days",
    "icon": "📋",
    "label": {
      "en": "Protocol — 1–2 days, hands-on: 3–4 hours",
      "zh": "实验方案 — 1–2 天，实操: 3–4 小时"
    }
  }
}
```

---

## Field Reference

### Required Fields — All Categories

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique `snake_case` identifier (filename without `.json`) |
| `name` | string | Full English name |
| `nameCn` | string | Full Chinese name |
| `category` | string | `buffer`, `protocol`, `staining`, or `media` |
| `discipline` | array | See [Discipline Values](#discipline-values) |
| `tags` | array | Freeform keyword tags for search |
| `usage` | `{en, zh}` | One-sentence bilingual description |
| `notes` | `{en, zh}` | Bilingual tips, troubleshooting |
| `components` | array | Reagent list (buffers) or step list (protocols) |
| `ref` | string | Citation: `Author (Year) Journal Vol:Pages` |
| `relatedProtocols` | array | Related recipe IDs (must exist in the database) |

### Required Fields — Buffers / Media / Staining

| Field | Type | Description |
|-------|------|-------------|
| `volume` | number | Default preparation volume |
| `volumeUnit` | string | Unit: `mL`, `L`, etc. |
| `storage` | object | `{ temperature, duration, sterile, notes }` |
| `prepSteps` | array | `[{ en, zh }]` — bilingual preparation instructions |

**`storage.sterile` values:** `autoclave`, `filter_022`, `filter_045`, `not_required`

### Required Fields — Protocols

| Field | Type | Description |
|-------|------|-------------|
| `duration` | object | `{ total, hands_on }` |
| `materials` | array | `[{ name, linkedRecipe?, optional? }]` — equipment & reagents |
| `safeStops` | array | **REQUIRED.** `[{ afterStep: <int>, note: {en, zh} }]` — safe stopping points |
| `detailedSteps` | array | **REQUIRED.** `[{ en, zh, isHeader?, time?, temp? }]` — step tracker |
| `briefSteps` | array | **REQUIRED.** `[{ en, zh }]` — one-line workflow summary |
| `storage` | object | `{ temp: "N/A", duration, icon: "📋", label: {en, zh} }` |

### Component Object (Buffers/Media/Staining)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Reagent name |
| `amount` | number/null | Amount (`null` = "to volume") |
| `unit` | string | `g`, `mg`, `mL`, `µL`, etc. |
| `concentration` | string | Final concentration, e.g. `50 mM` |
| `mw` | number | Molecular weight (g/mol) |
| `note` | `{en, zh}` | Bilingual tip (⚠️ must be object, NOT string) |
| `linkedRecipe` | string | ID of a linked recipe |
| `optional` | boolean | Whether component is optional |

### Component Object (Protocols)

Protocol components represent summary steps:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Step description, e.g. `"1. Lyse cells in RIPA buffer"` |
| `amount` | number | Always `1` |
| `unit` | string | Always `"step"` |
| `note` | `{en, zh}` | Bilingual tip (⚠️ must be object, NOT string) |

### Discipline Values

Use one or more of:
`molecular`, `cell`, `protein`, `rna_dna`, `immunology`, `microbiology`, `biochemistry`, `histology`, `genomics`, `general`

---

## Quality Checklist

Every recipe **MUST** pass all applicable checks before merging:

### All Recipes
- [ ] `id` matches filename (e.g. `pbs_10x` → `pbs_10x.json`)
- [ ] `name` and `nameCn` both filled
- [ ] `usage` has both `en` and `zh`
- [ ] `notes` has both `en` and `zh`
- [ ] `discipline` array is non-empty
- [ ] `tags` array is non-empty
- [ ] `relatedProtocols` contains valid recipe IDs (verified against database)
- [ ] `component.note` is `{en, zh}` object, **never** a bare string
- [ ] No `"nan"`, `"N/A"` (except protocol `storage.temp`), `"none"`, `"null"`, `"undefined"` values
- [ ] Valid JSON (parseable)

### Buffers / Media / Staining
- [ ] `storage` object with `temperature`, `duration`, `sterile`
- [ ] `prepSteps` array with `{en, zh}` bilingual steps
- [ ] `volume` and `volumeUnit` present

### Protocols
- [ ] `safeStops` — at least 1 scientifically accurate stopping point with `afterStep` (integer) and bilingual `note`
- [ ] `detailedSteps` — at least 8 steps with day headers (`isHeader: true`), times, temperatures, all bilingual
- [ ] `briefSteps` — at least 1 bilingual workflow summary using → arrows
- [ ] `materials` — equipment and reagents list with `linkedRecipe` cross-references where applicable
- [ ] `duration` with `total` and `hands_on`
- [ ] `storage` with `temp: "N/A"` and descriptive `label`

---

## Merge Strategy

`merge-recipes.js` combines repo recipes with existing deployed data:

1. **Existing (deployed) takes precedence** for manually curated fields: `detailedSteps`, `briefSteps`, `materials`, `safeStops`, `prepSteps`
2. **Repo provides** new fields: `discipline`, `usage`, `storage`, `relatedProtocols`
3. **Repo v2 direct fields** (safeStops, detailedSteps, briefSteps written directly into repo JSON) are passed through to the output
4. **New recipes** not in deployed data are converted from repo format

This means: if you add `detailedSteps` to a repo JSON file, it will appear in the merged output. If the deployed app already has different `detailedSteps` for that recipe, the deployed version wins.

---

## Sync with Web App

The LabMate app syncs recipes from GitHub:
- **URL:** `https://raw.githubusercontent.com/mianaz/labmate-recipes/main/dist/recipes.json`
- **Trigger:** User clicks the sync button in the app header
- **Fallback:** If GitHub is unreachable, uses local `recipes.json`

To update the app's recipe database:
1. Edit individual recipe JSON files in `recipes/`
2. Run `node merge-recipes.js --existing /path/to/deployed.json --out dist/recipes.json`
3. Commit and push both the recipe files and `dist/recipes.json`

---

## Contributing

1. Fork this repo
2. Copy a template from `templates/` into the correct `recipes/` subfolder
3. Fill in **all** required fields per the [Quality Checklist](#quality-checklist)
4. Run `node merge-recipes.js && node sync.js validate`
5. Open a PR with the source reference

### Guidelines

- **References required** — include DOI, PMID, or credible organization source
- **No lab-specific content** — no personal names, room numbers, or internal links
- **Bilingual** — ALL text fields must have both `en` and `zh`
- **Standard units** — use g, mg, mL, µL, M, mM, µM, nM
- **Tag generously** — tags power search (technique, application, organism)
- **Cross-link liberally** — use `relatedProtocols` to connect related recipes
- **Use `linkedRecipe`** — connect materials and components to existing recipes by ID
- **`component.note` must be `{en, zh}`** — never a bare string (causes React error #31)
- **Safe stops are mandatory** — every protocol needs at least one real stopping point
- **Step tracker is mandatory** — every protocol needs detailedSteps and briefSteps

### Common Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| `"note": "some tip"` | `"note": {"en": "some tip", "zh": "一些提示"}` |
| `"storage": {"temp": "N/A"}` for buffers | `"storage": {"temperature": "4°C", "duration": "6 months", ...}` |
| `"crosslinks": [...]` | `"relatedProtocols": [...]` |
| `"stoppingPoints": [...]` | `"safeStops": [{afterStep: <int>, note: {en, zh}}]` |
| Missing `detailedSteps` | Add ≥8 bilingual steps with headers, times, temps |
| Referencing non-existent recipe IDs | Verify all IDs exist in `dist/recipes.json` |

---

## Sources

Recipes sourced from:
- Cold Spring Harbor Laboratory (CSHL) protocols
- Nature Protocols / Nature Methods
- STAR Protocols (Cell Press)
- protocols.io community protocols
- Sambrook & Russell — Molecular Cloning
- Thermo Fisher / Promega / NEB technical manuals
- Cell Signaling Technology / Abcam application guides
- ATCC cell culture guides
- 10X Genomics / BioLegend technical protocols

## Stats

| Category | Count |
|----------|-------|
| Buffers | 97 |
| Media | 11 |
| Staining | 8 |
| Protocols | 99 |
| **Total** | **215** |

## License

CC BY 4.0 — Free to use, modify, and share with attribution.
