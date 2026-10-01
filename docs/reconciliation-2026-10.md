# Reconciling the app library and the recipe sources (2026-10)

Until 2026-10 the published library (`dist/recipes.json`) was built by hand on the server by merging these files with the deployed app's own `recipes.json`, and recipes were also added to the app directly. The copies drifted: the published library stopped at **227** recipes on 2026-07-13 while the app had **236**, so the app's *Refresh* refused it (`missing_ids:9`) and fell back to its bundled copy, and source improvements to steps and safe-stops never reached users because the merge let the app's copy win for those fields.

This one-time reconciliation produced a single library of **239** recipes, written back into `recipes/` so that `build-recipes.js` reproduces it exactly (checked recipe by recipe, field by field). From now on `recipes/` is the only source; see *Publishing* in the README.

## Rules

1. **Most recent edit wins**, per recipe and per field — the edit time of each field on each side was read from the full git history of both repos (9 app commits, 24 source commits), comparing values through the same converter.
2. **…unless that version measurably loses** Chinese coverage, `{v:…}` volume-scaling tokens, step timers or notes that the other has. Then the other side wins. (No field lost something on both sides.)
3. **Prep-step text must agree with the recipe's own volume** ("bring to final volume of N mL").
4. **DOIs must resolve to the cited paper** — every DOI was looked up on Crossref and kept only if its first author appears in the recipe's citation; otherwise replaced with the cited paper's DOI when surname, year and volume:page (or title) all match, or dropped (the citation text stays).
5. **Data fixes** listed below.

## What each field took

| field | from app | from source | overridden by rules 2–3 |
|---|---:|---:|---:|
| `briefSteps` | 0 | 68 | 0 |
| `components` | 18 | 105 | 17 |
| `defaultVolume` | 0 | 1 | 0 |
| `detailedSteps` | 0 | 68 | 0 |
| `doi` | 0 | 20 | 0 |
| `duration` | 4 | 0 | 0 |
| `materials` | 87 | 3 | 71 |
| `ph` | 30 | 0 | 0 |
| `prepSteps` | 72 | 3 | 65 |
| `ref` | 0 | 24 | 0 |
| `relatedProtocols` | 9 | 88 | 0 |
| `safeStops` | 18 | 80 | 26 |
| `storage` | 28 | 0 | 0 |
| `unit` | 23 | 1 | 0 |

Fields equal on both sides are not listed. Every individual decision (recipe, field, side, reason, edit dates) is in [`reconciliation-2026-10.json`](reconciliation-2026-10.json).

### Overrides

- **21×** prepSteps → kept the app's version: newer version loses Chinese, scaling tokens — e.g. `perm_buffer_triton`, `pbs_1x`, `running_buffer`, `tbst`
- **17×** components → kept the app's version: newer version loses Chinese — e.g. `edta_trypsin`, `pfa_4`, `citrate_buffer_ar`, `gst_elution`
- **44×** prepSteps → kept the app's version: newer version loses Chinese — e.g. `edta_trypsin`, `transfer_buffer`, `laemmli_2x`, `pfa_4`
- **16×** safeStops → kept the source's version: newer version loses notes — e.g. `cite_seq_10x`, `competent_cell_bulk`, `competent_cells_electrocompetent`, `er_golgi_isolation`
- **68×** materials → kept the app's version: newer version loses Chinese, notes — e.g. `agarose_gel_electrophoresis`, `annexin_v_apoptosis`, `chromatin_accessibility_atac`, `electroporation`
- **10×** safeStops → kept the app's version: newer version loses notes — e.g. `agarose_gel_electrophoresis`, `ethanol_precipitation`, `gibson_assembly`, `northern_blot`
- **1×** materials → kept the source's version: newer version loses notes — e.g. `tumor_dissociation`
- **2×** materials → kept the source's version: newer version loses Chinese, notes — e.g. `lentivirus_concentration_peg`, `lentivirus_concentration_sucrose_cushion`

In short: buffer prep steps and protocol materials keep the app's bilingual, annotated versions (the v2 `{step}` prep-step shape cannot hold Chinese, and the source's materials lists had no notes); detailed and brief steps, references, cross-links and most safe-stops come from the source, which had been edited later (bilingual-coverage and reference-quality passes) — about twice as many step timers as before.

## New recipes

- `coip_human_cells` — Co-immunoprecipitation in Human Cells (Dynabeads)
- `ms_acetone_precipitation` — MS Sample Preparation by Acetone Precipitation
- `organoid_drug_screening` — Drug Sensitivity Assays of Human Cancer Organoid Cultures

## DOIs

Checked 56: kept 43, corrected 5, removed 8.

| recipe | was | now | evidence |
|---|---|---|---|
| `ecl_enhanced` | `10.1016/j.ab.2013.12.033` (Chen 2014 “Quantitation of the residual DNA from rice-derived recombina”) | — (removed) | no DOI found that matches the citation |
| `cck8_proliferation` | `10.1016/S0039-9140(96)02264-5` (not found) | `10.1016/s0039-9140(97)00017-9` | Ishiyama 1997 44:1299-1305 “A highly water-soluble disulfonated tetrazolium salt as a chromogenic ” |
| `er_golgi_isolation` | `10.1016/j.xpro.2021.100450` (Chen 2021 “Processing single-cell RNA-seq data for dimension reduction-”) | — (removed) | no DOI found that matches the citation |
| `fbs_heat_inactivation` | `10.1016/j.biotechadv.2010.03.003` (Celińska 2010 “Debottlenecking the 1,3-propanediol pathway by metabolic eng”) | — (removed) | no DOI found that matches the citation |
| `pulldown_assay` | `10.1007/978-1-4939-7033-9_37` (Habenstein 2017 “Erratum to: Bacterial Filamentous Appendages Investigated by”) | — (removed) | no DOI found that matches the citation |
| `ihc_paraffin_protocol` | `10.1177/0300985813503571` (Ward 2013 “Rodent Immunohistochemistry”) | — (removed) | no DOI found that matches the citation |
| `pbmc_isolation` | `10.1002/9783527698622.ch12` (not found) | `10.1016/s0171-2985(84)80042-x` | Ulmer 1984 166:238-250 “Isolation and Subfractionation of Human Peripheral Blood Mononuclear C” |
| `stable_cell_line_selection` | `10.1038/s41596-020-0389-3` (not found) | — (removed) | no DOI found that matches the citation |
| `subcellular_fractionation` | `10.1016/j.xpro.2021.100450` (Chen 2021 “Processing single-cell RNA-seq data for dimension reduction-”) | `10.1093/nar/11.5.1475` | Dignam 1983 11:1475-1489 “Accurate transcription initiation by RNA polymerase II in a soluble ex” |
| `therapeutic_antibody_dilution` | `10.1038/nri2727` (Tokoyoda 2010 “Organization of immunological memory by bone marrow stroma”) | `10.1038/nri2744` | Weiner 2010 10:317-327 “Monoclonal antibodies: versatile platforms for cancer immunotherapy” |
| `nanopore_library_prep` | `10.17504/protocols.io.bp2l6n6brgqe/v2` (not found) | — (removed) | no DOI found that matches the citation |
| `rip_protocol` | `10.1038/nprot.2006.46` (Zelazo 2006 “The Dimensional Change Card Sort (DCCS): a method of assessi”) | `10.1038/nprot.2006.47` | Keene 2006 1:302-307 “RIP-Chip: the isolation and identification of mRNAs, microRNAs and pro” |
| `rrbs_protocol` | `10.1093/nar/gkn425` (Dohm 2008 “Substantial biases in ultra-short read data sets from high-t”) | — (removed) | no DOI found that matches the citation |

## Data fixes

- gst_tag_purification: removed duplicate link
- hcr_rna_fish: dropped non-numeric duration
- idisco_clearing: dropped non-numeric duration
- seahorse_mito_stress: dropped non-numeric duration
- transcardial_perfusion: dropped non-numeric duration
- hichip_protocol: wrote bilingual notes for 4 safe-stops
- sc_cut_and_tag: wrote bilingual notes for 2 safe-stops
- `gst_tag_purification`: duplicate entry removed from `crosslinks` in the source file.

## Known issues left as they are

Present in both copies before this reconciliation, so it could not choose between them; they need a content decision. QC now warns about the first group.

- Prep-step text names a different final volume than the recipe: `dialysis_buffer_generic` (2000 vs 1000 mL), `imac_elution_500` (500 vs 1000), `imac_wash_highsalt` (1000 vs 500), `lysis_buffer_mild` (500 vs 100), `lysosome_isolation_buffer` (500 vs 100), `mitochondria_buffer` (500 vs 100), `nuclei_isolation_buffer` (500 vs 50), `sec_running_buffer` (2000 vs 1000), `sucrose_gradient_homog` (500 vs 100).
- `phosphatase_inhibitor_na3vo4`: volume 50 mL, but 1.84 g Na₃VO₄ and "ddH₂O to 100 mL" are for 100 mL (100 mM × 0.1 L × 183.9 g/mol).
- About 20 safe-stops use a text `afterStep` ("Step 6", "Gel casting"); the app places safe-stops by step number only, so these do not show.
