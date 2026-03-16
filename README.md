# 🧬 LabMate Recipe Library

Open-source recipe and protocol library for [BioinfoSpace LabMate](https://apps.bioinfospace.com/lab_toolkit/).

## Structure

```
recipes/
  buffers/          # Buffer recipes (PBS, RIPA, etc.)
  protocols/        # Step-by-step protocols (WB, ChIP, etc.)
  staining/         # Staining solutions (Coomassie, silver, etc.)
  media/            # Culture media (LB, DMEM, etc.)
index.json          # Master index — auto-generated
schema.json         # JSON Schema for recipe validation
```

Each recipe is a single `.json` file. The `index.json` is rebuilt automatically and consumed by LabMate's sync feature.

## Recipe Format

```json
{
  "id": "pbs_10x",
  "name": "10× PBS",
  "nameCn": "10× 磷酸盐缓冲液",
  "category": "buffer",
  "tags": ["common", "cell biology", "WB"],
  "volume": 1000,
  "volumeUnit": "mL",
  "components": [
    { "name": "NaCl", "amount": 80, "unit": "g", "mw": 58.44 },
    { "name": "KCl", "amount": 2, "unit": "g", "mw": 74.55 }
  ],
  "notes": { "en": "English notes...", "zh": "中文说明..." },
  "ref": "Sambrook & Russell (2001)",
  "doi": "10.1101/pdb.rec8247",
  "crosslinks": ["pbs_1x"],
  "source": "CSHL"
}
```

## Sync with Web App

`sync.js` keeps the repo and the live web app (`index.html`) in sync.

```bash
node sync.js diff       # Show differences between repo and web app
node sync.js import     # Repo → web app (adds new, updates changed)
node sync.js export     # Web app → repo JSON files
node sync.js validate   # Check all JSON files for schema issues
```

**Workflow:**
1. Edit recipes in `recipes/` JSON files (the source of truth)
2. Run `node sync.js import` to push changes into the live `index.html`
3. Web-app-specific fields (`defaultVolume`, `briefSteps`, `detailedSteps`, `safeStops`, `relatedProtocols`) are preserved during import
4. If recipes are added directly in the web app, run `node sync.js export` to pull them back into the repo

**Environment variables:**
- `LABMATE_HTML` — path to live `index.html` (default: `/var/www/apps.bioinfospace.com/lab_toolkit/index.html`)
- `LABMATE_REPO` — path to this repo root (default: script directory)

## Contributing

1. Fork this repo
2. Add your recipe as a `.json` file in the appropriate category folder
3. Run `npm run validate` to check schema compliance
4. Open a PR with the source reference

### Guidelines
- Include DOI or credible reference for every recipe
- Use standard units (g, mg, mL, µL, M, mM)
- Include both `en` and `zh` notes when possible
- Tag generously — it helps search
- Use `crosslinks` to reference related recipes by ID

## Sources

Recipes sourced from:
- Cold Spring Harbor Laboratory (CSHL) protocols
- Nature Protocols / Nature Methods
- STAR Protocols (Cell Press)
- protocols.io community protocols
- Sambrook & Russell — Molecular Cloning
- Thermo Fisher / Promega / NEB technical manuals

## License

CC BY 4.0 — Free to use, modify, and share with attribution.
