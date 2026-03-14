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

## Importing into LabMate

In LabMate → Guide tab → "Import from Library":
1. Click **Sync Library** to fetch the latest index
2. Browse by category or search
3. Click **Import** on individual recipes or **Import All** for a category
4. Imported recipes appear alongside built-in ones

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
