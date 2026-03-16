# Protocol Accuracy & Clarity Audit

Reviewed: 53 protocols in labmate-recipes repo
Date: 2026-03-16

## Issues Found

### 1. ACCURACY ISSUES

#### trizol_extraction — Missing step-by-step protocol
- **Issue**: Only lists reagent amounts, no actual steps (lyse → phase separation → precipitation → wash → dissolve)
- **Severity**: HIGH — unusable as a protocol
- **Fix**: Convert to step-by-step format matching other protocols, or add `detailedSteps`

#### colony_pcr — Primer concentration error
- **Issue**: Note says "400 nM final" for 1 µL of 10 µM in 25 µL total → actual final is 400 nM. This is correct.
- **Status**: OK (verified)

#### cell_thawing — Missing centrifugation step
- **Issue**: Step 4 says "转移至 9 mL 预热培养基" but doesn't mention centrifugation option. Many protocols recommend centrifuging (200×g, 5 min) to remove DMSO rather than just diluting. The zh note says "不要离心（脆弱细胞）" which contradicts common practice.
- **Severity**: MEDIUM — should mention both approaches
- **Fix**: Add note: "Sensitive cells: dilute directly. Most cell lines: centrifuge 200×g 5 min to pellet, resuspend in fresh medium"

#### lentivirus_production — Missing packaging plasmid details
- **Issue**: Step 2 says "配制转染复合物" but doesn't specify the 3-plasmid system (transfer + psPAX2 + pMD2.G) or DNA ratios
- **Severity**: MEDIUM — critical info for first-time users
- **Fix**: Add substep with DNA ratio: transfer:psPAX2:pMD2.G = 4:3:1 (e.g., 10:7.5:2.5 µg for 10 cm dish)

#### electroporation — Pulse parameters incomplete
- **Issue**: Lists "1.8 kV, 25 µF, 200 Ω" but these are for 1 mm cuvettes. 2 mm cuvettes need 2.5 kV. Gap width not specified.
- **Severity**: LOW — but could cause failed experiments
- **Fix**: Add note specifying cuvette gap (1 mm) and alternative for 2 mm

#### comet_assay — Lysis time missing
- **Issue**: Step 2 lists lysis buffer composition but no incubation time
- **Severity**: MEDIUM — standard is 1 h to overnight at 4°C
- **Fix**: Add "4°C, 1 h minimum (overnight OK)"

#### soft_agar_assay — Temperature precision
- **Issue**: Notes say "Noble agar at exactly 42°C" — this is for the top layer mixing. Base layer is poured at ~45°C.
- **Severity**: LOW — but "42°C" is too specific; 40-42°C is the workable range
- **Fix**: Clarify "cool agar to 40-42°C before mixing with cells (>42°C kills cells, <37°C premature solidification)"

### 2. CLARITY ISSUES

#### trypan_blue_counting vs cell_counting_hemocytometer — Redundant protocols
- **Issue**: Both cover essentially the same procedure (trypan blue + hemocytometer counting)
- **Fix**: Consider merging, or clearly differentiate (one focused on trypan blue exclusion, other on hemocytometer technique)

#### cell_freezing — Missing freezing medium composition
- **Issue**: Step 6 says "冻存液重悬" but doesn't specify composition in steps (only in notes: 10% DMSO/90% FBS)
- **Fix**: Move composition into step note: "90% FBS + 10% DMSO; or commercial CryoStor CS10"

#### chip_protocol — Sonication needs more detail
- **Issue**: Step 5 says "超声 (200–500 bp 片段)" with note "需优化条件" but gives no starting parameters
- **Fix**: Add example: "Bioruptor: 30s on / 30s off, 15-25 cycles, high power; or probe sonicator: 10s pulses × 10"

#### mtt_assay — MTT stock preparation missing
- **Issue**: Step 5 says "10 µL MTT (5 mg/mL)" but doesn't mention that MTT stock must be prepared fresh in PBS and filter-sterilized
- **Fix**: Add note about stock preparation

#### dual_luciferase — Too brief
- **Issue**: Only 5 steps, no volume/timing details. Doesn't mention how much PLB to add, incubation time for lysis
- **Severity**: MEDIUM
- **Fix**: Add: "100 µL PLB per well (24-well), rock 15 min RT" and substrate volumes

#### clonogenic_assay — Missing seeding density guidance
- **Issue**: Says "200-1000 cells/well" but doesn't explain how to choose — depends on plating efficiency of cell line
- **Fix**: Add: "Start with 200 cells (high PE cells like HeLa), 500-1000 for harder-to-plate lines. Adjust based on PE"

### 3. FORMAT INCONSISTENCIES

#### Mixed language in step names
- Some protocols use Chinese step names (wb_protocol, chip_protocol, cell_freezing)
- Others use English (annexin_v_apoptosis, comet_assay, southern_blot)
- Some mix both in the same protocol
- **Fix**: Standardize — either all have nameCn + use Chinese steps, or add bilingual steps consistently

#### Notes format inconsistency
- Most new protocols (my additions): notes as plain string (Chinese only)
- Most original protocols: notes as `{ en: "...", zh: "..." }` object
- **Fix**: Standardize all to `{ en, zh }` format

#### Missing nameCn
- `trizol_extraction` has nameCn
- But some older protocols may be missing it
- **Fix**: Audit and add nameCn where missing

#### TRIzol extraction is recipe-format, not protocol-format
- Only protocol in the collection without steps (unit: "step")
- Should be converted to step-based format

### 4. SCIENTIFIC CONCERNS (minor)

#### bca_protein_assay — Bradford tag is misleading
- Tags include "Bradford" but this is a BCA protocol. Bradford is a separate assay (Coomassie binding, 595 nm)
- **Fix**: Remove "Bradford" from tags, or add a separate Bradford protocol

#### pcr_standard — Primer final concentration
- 1 µL of 10 µM in 50 µL total = 0.2 µM. Note says "终浓度 0.2 µM" ✓ Correct

#### restriction_digest — Buffer volume for 50 µL reaction
- 5 µL of 10× buffer for 50 µL reaction = 1× ✓ Correct

## Summary

| Category | Count | Priority |
|----------|-------|----------|
| Missing/incomplete steps | 4 | HIGH |
| Accuracy errors | 3 | MEDIUM |
| Clarity improvements | 6 | MEDIUM |
| Format inconsistencies | 4 | LOW |
| Scientific concerns | 1 | LOW |
| Redundancies | 1 | LOW |
| **Total** | **19** | |

## Recommendations (Priority Order)

1. **trizol_extraction**: Rewrite as step-by-step protocol (HIGH)
2. **lentivirus_production**: Add packaging plasmid ratios (MEDIUM)
3. **cell_thawing**: Add centrifugation option (MEDIUM)
4. **comet_assay**: Add lysis incubation time (MEDIUM)
5. **Standardize notes format**: All use `{ en, zh }` (batch fix)
6. **Standardize step language**: Bilingual or consistent Chinese
7. **bca_protein_assay**: Remove "Bradford" tag
8. **Merge or differentiate**: trypan_blue_counting vs cell_counting_hemocytometer
