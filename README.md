# LabMate Recipe Library

Open-source recipe and protocol library for [BioinfoSpace LabMate](https://apps.bioinfospace.com/lab_toolkit/).

## Structure

```
recipes/
  buffers/          # Buffer recipes (PBS, RIPA, etc.)
  protocols/        # Step-by-step protocols (WB, ChIP, etc.)
  staining/         # Staining solutions (Coomassie, silver, etc.)
  media/            # Culture media (LB, DMEM, etc.)
templates/          # Empty JSON templates for each category
schema.json         # JSON Schema for recipe validation
build-recipes.js    # Build script: repo JSON → dist/recipes.json
dist/recipes.json   # Pre-built recipes.json for app sync
```

Each recipe is a single `.json` file. The `dist/recipes.json` is rebuilt by `build-recipes.js` and consumed by LabMate's sync feature.

## Quick Start

### Adding a new recipe

1. Copy the appropriate template from `templates/`:
   - `templates/buffer_template.json` — buffers, stock solutions, reagents
   - `templates/protocol_template.json` — step-by-step experimental protocols
   - `templates/media_template.json` — cell culture media
   - `templates/staining_template.json` — staining solutions
2. Fill in all fields (see [Field Reference](#field-reference) below)
3. Save to the correct subfolder in `recipes/`
4. Run `node build-recipes.js` to rebuild `dist/recipes.json`
5. Run `node sync.js validate` to check schema compliance

### Building

```bash
node build-recipes.js                    # Build dist/recipes.json
node build-recipes.js --out /path/to.json  # Custom output path
```

## Recipe Format (v2 Schema)

### Buffer / Media / Staining Example

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
    { "name": "KCl", "amount": 2, "unit": "g", "mw": 74.55 }
  ],
  "prepSteps": [
    { "step": "Dissolve salts in 800 mL ddH₂O." },
    { "step": "Adjust pH to 7.4 with HCl.", "warning": "Use calibrated pH meter." },
    { "step": "Bring to 1000 mL. Autoclave." }
  ],
  "notes": { "en": "English notes...", "zh": "中文说明..." },
  "ref": "Sambrook & Russell (2001) Molecular Cloning",
  "doi": "10.1101/pdb.rec8247",
  "crosslinks": ["pbs_1x"]
}
```

### Protocol Example

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
    { "name": "1. Lyse cells in RIPA buffer", "amount": 1, "unit": "step" },
    { "name": "2. BCA protein quantification", "amount": 1, "unit": "step", "note": "20–50 µg/lane" },
    { "name": "3. SDS-PAGE electrophoresis", "amount": 1, "unit": "step" }
  ],
  "stoppingPoints": [
    { "afterStep": "Sample preparation", "condition": "−20°C in Laemmli buffer", "duration": "1 month" }
  ],
  "notes": { "en": "Tips...", "zh": "提示..." },
  "ref": "Mahmood & Yang (2012) N Am J Med Sci 4:429–434",
  "crosslinks": ["bca_protein_assay", "coomassie_staining"]
}
```

## Field Reference

### Required Fields (all categories)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique `snake_case` identifier |
| `name` | string | Full English name |
| `category` | string | `buffer`, `protocol`, `staining`, or `media` |
| `components` | array | Reagent list (buffers/media) or step list (protocols) |

### Recommended Fields (all categories)

| Field | Type | Description |
|-------|------|-------------|
| `nameCn` | string | Full Chinese name |
| `discipline` | array | One or more of: `molecular`, `cell`, `protein`, `rna_dna`, `immunology`, `microbiology`, `biochemistry`, `histology`, `genomics`, `general` |
| `tags` | array | Freeform keyword tags for search |
| `usage` | object | `{ "en": "...", "zh": "..." }` — one-sentence description |
| `notes` | object | `{ "en": "...", "zh": "..." }` — tips, troubleshooting |
| `ref` | string | Citation: `Author (Year) Journal Vol:Pages` or organization name |
| `doi` | string | DOI without `https://doi.org/` prefix |
| `source` | string | Journal or publisher |
| `crosslinks` | array | Related recipe IDs |

### Buffer / Media / Staining Fields

| Field | Type | Description |
|-------|------|-------------|
| `volume` | number | Default preparation volume |
| `volumeUnit` | string | Unit for volume (`mL`, `L`, etc.) |
| `storage` | object | `{ temperature, duration, sterile, notes }` |
| `prepSteps` | array | `[{ step, note?, warning? }]` — preparation instructions |

**Storage `sterile` values:** `autoclave`, `filter_022`, `filter_045`, `not_required`

### Component Object (buffers/media/staining)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Reagent name (with stock concentration if applicable) |
| `amount` | number/null | Amount to add (`null` for "to volume") |
| `unit` | string | `g`, `mg`, `mL`, `µL`, etc. |
| `concentration` | string | Final concentration, e.g. `50 mM` |
| `mw` | number | Molecular weight (g/mol) |
| `note` | string/object | Tip or `{ "en": "...", "zh": "..." }` |
| `linkedRecipe` | string | ID of a linked recipe |
| `optional` | boolean | Whether component is optional |

### Protocol-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `duration` | object | `{ total, hands_on, notes? }` |
| `materials` | array | `[{ name, linkedRecipe?, optional? }]` |
| `stoppingPoints` | array | `[{ afterStep, condition, duration }]` |

Protocol `components` use `name` as step description with `"amount": 1, "unit": "step"`.

## Sync with Web App

`sync.js` keeps the repo and the live web app in sync.

```bash
node sync.js diff       # Show differences between repo and web app
node sync.js import     # Repo → web app
node sync.js export     # Web app → repo JSON files
node sync.js validate   # Check all JSON files for schema issues
```

**Environment variables:**
- `LABMATE_HTML` — path to live `index.html` (default: `/var/www/apps.bioinfospace.com/lab_toolkit/index.html`)
- `LABMATE_REPO` — path to this repo root (default: script directory)

## Contributing

1. Fork this repo
2. Copy a template from `templates/` into the correct `recipes/` subfolder
3. Fill in all required and recommended fields
4. Run `node build-recipes.js && node sync.js validate`
5. Open a PR with the source reference

### Guidelines

- **References required** — include DOI, PMID, or credible organization for every recipe
- **No lab-specific content** — do not include personal names, lab room numbers, internal storage locations, or Google Drive links
- **Bilingual** — include both `en` and `zh` for `usage`, `notes`, and `nameCn`
- **Standard units** — use g, mg, mL, µL, M, mM, µM, nM
- **Tag generously** — tags help search (technique, application, organism)
- **Crosslink liberally** — use `crosslinks` to reference related recipes by ID
- **Use `linkedRecipe`** — connect materials and components to existing recipes
- **Protocols** — must include `duration`, `materials`, and at least one `stoppingPoint`
- **Buffers/media** — must include `storage`, `volume`/`volumeUnit`, and `prepSteps`

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
| Buffers | 96 |
| Media | 11 |
| Staining | 8 |
| Protocols | 99 |
| **Total** | **214** |

## License

CC BY 4.0 — Free to use, modify, and share with attribution.
