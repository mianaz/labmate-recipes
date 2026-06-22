# Recipe Quality Audit — 2026-06-22

> Supersedes 2026-03-19. The March audit was stale and used the wrong field name
> for stopping points (`safeStops` vs the actual `stoppingPoints`), so it
> under-counted problems. This version is correct against the live schema.

## Summary (217 recipes)

| Metric | Value | Status |
|---|---|---|
| Total recipes | 217 | — |
| Protocols | 101 | — |
| Buffers | 97 | — |
| Media | 11 | — |
| Staining | 8 | — |
| Invalid JSON | 0 | ✅ |
| Missing required fields | 0 | ✅ |
| NaN / null / undefined | 0 | ✅ |
| Duplicate ids | 0 | ✅ |
| Bilingual coverage (en ∩ zh on named fields) | 100% | ✅ |
| Invalid crosslinks (`relatedProtocols` / `linkedRecipes`) | 0 | ✅ |
| **Protocols missing `detailedSteps`** | **68 / 101** | ❌ |
| **Protocols missing `briefSteps`** | **68 / 101** | ❌ |
| **Protocols missing `stoppingPoints`** *(or legacy `safeStops`)* | **6 / 101** | ❌ |
| **Protocols with no `unit:"step"` components** | **12 / 101** | ❌ |
| **Buffers missing `relatedProtocols`** | **95 / 97** | ❌ |
| Buffers missing `prepSteps` | 0 | ✅ |
| Buffers missing `storage` (object) | 0 | ✅ |
| Protocols missing `materials` | 0 | ✅ |

## Issue buckets

### 1. Protocols missing `detailedSteps` (68)

`detailedSteps` is the long-form bilingual walkthrough shown in the protocol
view. **Format:** JSON array of `{en, zh, isHeader}` objects. `isHeader: true`
for section dividers (e.g. `"**Day 1 — Overnight Culture**"`), false for
regular steps. Each non-header item should describe one concrete action with
time/temperature/conditions where applicable.

### 2. Protocols missing `briefSteps` (68)

Same protocol set as #1. **Format:** JSON array of `{en, zh}` strings — one
short narrative sentence per step in each language (the "card" view).

### 3. Protocols missing `stoppingPoints` (6)

The field is **`stoppingPoints`** (some legacy files use the alias `safeStops`).
**Format:** JSON array of `{afterStep, condition, duration}` objects. The 6
missing: `bradford_assay_protocol, tube_formation_assay,
bacterial_glycerol_stock, cck8_proliferation, electroporation,
enzyme_kinetics_michaelis`.

### 4. Protocols with no `unit:"step"` components (12)

These have a `components` list but it contains only reagents — no actual
procedure. The app cannot render a runnable protocol for them. The 12 are:
`pdx_implantation, fbs_heat_inactivation, cite_seq_10x, cytof_staining,
ngn2_neuron_induction, if_cryostat, tumor_dissociation, competent_cell_bulk,
multiplex_if, genotyping_pcr, therapeutic_antibody_dilution,
ctc_detection_pcr`. For these, both `components` (with `unit: "step"` entries)
**and** `detailedSteps` / `briefSteps` need to be generated from scratch.

### 5. Buffers missing `relatedProtocols` (95/97)

The repo has 97 buffers; only 2 (`bn_page_cathode`, `oil_red_o`) have
`relatedProtocols` crosslinks. The other 95 are listed in
`audit-issues-2026-06-22.json → buffer_no_relatedProtocols`. Most are obvious
(`pbs_1x`, `tae_50x`, `pcr_buffer_10x`, `laemmli_*`, `te`, etc.) but the
crosslink work was never extended past the first two.

## Notes on the prior audit

The 2026-03-19 audit claimed 99/99 protocols had `safeStops` and 215/215 recipes
were clean. Both numbers were wrong because:

1. **Field-name mismatch:** the actual field is `stoppingPoints`; only 14 files
   also use the alias `safeStops`, 30 use `safeStops` only, 51 use
   `stoppingPoints` only. Searching for just `safeStops` misses 65 protocols.
2. **Recipe count drift:** 215 → 217 (added 2 between 3/19 and 6/22).
3. **`unit === 'step'` vs `type === 'step'`:** the prior audit script checked
   `c.type === 'step'`, but the schema uses `c.unit === 'step'`. That single
   typo made the "no step components" check return false-clean. The repo's
   `node sync.js validate` was always correct; only the standalone Python
   audit was wrong.
4. **Buffer crosslinks:** the March audit added crosslinks to 2 buffers and
   treated that as "done" — the other 95 were left untouched.

## Plan to fix (this run)

Use parallel **sonnet-4.6** subagents grouped by protocol family, each writing
the missing fields directly into the recipe JSON files. After all subagents
finish, run this audit script again to confirm 0 errors and validate JSON via
`node sync.js validate`.

Family splits (subject to load balancing):

- **A. Nucleic acid prep** (~10): genomic_dna_extraction, rna_column_extraction,
  trizol_extraction, gel_extraction, ethanol_precipitation, dna_ligation,
  restriction_digest, plasmid_maxiprep, miniprep_protocol, southern_blot,
  northern_blot
- **B. PCR / qPCR / NGS / cloning** (~11): pcr_standard, qpcr_protocol,
  colony_pcr, mycoplasma_pcr, rnaseq_library_prep, crispr_sgrna_cloning,
  gibson_assembly, site_directed_mutagenesis, cut_and_run, chip_protocol,
  chromatin_accessibility_atac, sirna_knockdown
- **C. Cell culture + transformation** (~12): cell_passage, cell_transfection,
  cell_freezing, cell_thawing, calcium_phosphate_transfection, electroporation,
  lentivirus_production, competent_cells_cacl2, heat_shock_transformation,
  competent_cell_bulk, pdx_implantation, ngn2_neuron_induction,
  fbs_heat_inactivation, genotyping_pcr
- **D. Protein / WB / IP / purification** (~11): wb_protocol,
  immunoprecipitation, coip_protocol, gst_tag_purification,
  his_tag_purification, sec_purification, ion_exchange_chromatography,
  protein_dialysis, bacterial_protein_expression, comet_assay,
  coomassie_staining
- **E. Cell-based assays + viability** (~13): mtt_assay, cck8_proliferation,
  scratch_assay, transwell_migration, clonogenic_assay, soft_agar_assay,
  annexin_v_apoptosis, cell_cycle_pi, trypan_blue_counting,
  cell_counting_hemocytometer, flow_cytometry_protocol, tube_formation_assay,
  bradford_assay_protocol, bca_protein_assay, enzyme_kinetics_michaelis
- **F. Imaging / histology / single-cell** (~10): if_protocol, if_cryostat,
  multiplex_if, ihc_paraffin_protocol, proximity_ligation_assay,
  cytof_staining, cite_seq_10x, ctc_detection_pcr,
  therapeutic_antibody_dilution, tumor_dissociation
- **G. Other / misc** (~7): agarose_gel_electrophoresis, emsa_gel_shift,
  dual_luciferase, elisa_sandwich, mitochondria_isolation,
  subcellular_fractionation, bacterial_glycerol_stock

The 95 buffer crosslinks go to a separate subagent.

## How to re-run this audit

```bash
# Inline script in audit.py, or:
python3 -c "
import json, glob, os
base = 'recipes'
all_ids = set(); id_to_cat = {}; id_to_path = {}
for sub in ['protocols','buffers','media','staining']:
    cat = sub[:-1]
    for p in glob.glob(f'{base}/{sub}/*.json'):
        d = json.load(open(p))
        rid = d.get('id') or os.path.basename(p).replace('.json','')
        all_ids.add(rid); id_to_cat[rid] = cat; id_to_path[rid] = p
def hc(v):
    if not v: return False
    if isinstance(v, str): return bool(v.strip())
    if isinstance(v, dict):
        if 'en' in v or 'zh' in v: return bool(v.get('en') or v.get('zh'))
        return any(v.values())
    if isinstance(v, list): return len(v) > 0
issues = {k: [] for k in ['protocol_no_stoppingPoints','protocol_no_detailedSteps','protocol_no_briefSteps','protocol_no_step_components','buffer_no_relatedProtocols','invalid_relatedProtocols','invalid_linkedRecipes']}
for rid, p in id_to_path.items():
    d = json.load(open(p)); cat = id_to_cat[rid]
    if cat == 'protocol':
        sp = d.get('stoppingPoints') or d.get('safeStops')
        if not hc(sp): issues['protocol_no_stoppingPoints'].append(rid)
        for f, k in [('detailedSteps','protocol_no_detailedSteps'),('briefSteps','protocol_no_briefSteps')]:
            if not hc(d.get(f)): issues[k].append(rid)
        if not any(c.get('unit')=='step' for c in d.get('components',[])):
            issues['protocol_no_step_components'].append(rid)
    elif cat == 'buffer':
        rp = d.get('relatedProtocols')
        if not rp or (isinstance(rp,list) and len(rp)==0):
            issues['buffer_no_relatedProtocols'].append(rid)
    for rp in d.get('relatedProtocols',[]) or []:
        if rp not in all_ids: issues['invalid_relatedProtocols'].append((rid,rp))
    for c in d.get('components',[]) or []:
        for lr in c.get('linkedRecipes',[]) or []:
            if lr not in all_ids: issues['invalid_linkedRecipes'].append((rid,c.get('name','?'),lr))
for k,v in issues.items(): print(f'{k}: {len(v)}')
"
```

## Files

- `audit-issues-2026-06-22.json` — machine-readable issue lists
- `AUDIT.md` — this file
- `/tmp/labmate-recipes-backup-2026-06-22.tar.gz` — pre-fix snapshot