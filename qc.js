#!/usr/bin/env node
/**
 * labmate-recipes QC tool
 *
 * Quality-control checker for recipe JSON files. Runs mechanical checks
 * (field presence, schema compliance, format) and can optionally invoke
 * an LLM sub-agent for semantic review (reference realism, scientific
 * accuracy, bilingual quality).
 *
 * Usage:
 *   node qc.js                  QC all recipes
 *   node qc.js <recipe-id>      QC a single recipe (id or filename)
 *   node qc.js <recipe-id> --llm   Add LLM review (slower, requires agent)
 *   node qc.js --all --llm      QC all recipes with LLM review
 *   node qc.js --strict         Fail on WARN-level issues
 *   node qc.js --json           Machine-readable JSON output
 *   node qc.js --report         Write HTML report to qc-report.html
 *
 * Exit codes:
 *   0  No errors (warnings allowed unless --strict)
 *   1  Errors found, or strict mode failed
 *   2  Invalid usage
 */

const fs = require('fs');
const path = require('path');

const REPO_PATH = process.env.LABMATE_REPO || __dirname;
const RECIPES_DIR = path.join(REPO_PATH, 'recipes');

const CAT_DIRS = {
  buffer: 'buffers',
  protocol: 'protocols',
  media: 'media',
  staining: 'staining',
};

const REVERSE_CAT = Object.fromEntries(
  Object.entries(CAT_DIRS).map(([k, v]) => [v, k])
);

// ─── Mechanical checks ──────────────────────────────────────────────────────

/**
 * Run all mechanical checks on a single recipe.
 * Returns { errors: [], warnings: [], info: [] }
 */
function checkRecipe(recipe, filePath) {
  const issues = { errors: [], warnings: [], info: [] };
  const file = path.basename(filePath);
  const cat = recipe.category;

  const flag = (level, msg) => {
    const levelMap = { errors: 'ERROR', warnings: 'WARN', info: 'INFO' };
    issues[level].push({ level: levelMap[level], file, msg });
  };

  // Required fields
  if (!recipe.id) flag('errors', 'Missing id');
  if (!recipe.name) flag('errors', 'Missing name');
  if (!cat) flag('errors', 'Missing category');
  if (!recipe.components || !Array.isArray(recipe.components) || recipe.components.length === 0) {
    flag('errors', 'Missing or empty components');
  }

  // id matches filename
  if (recipe.id && recipe.id !== file.replace('.json', '')) {
    flag('warnings', `id '${recipe.id}' does not match filename '${file.replace('.json', '')}'`);
  }

  // Bilingual checks
  if (!recipe.nameCn) flag('warnings', 'Missing nameCn');
  if (recipe.usage && typeof recipe.usage === 'object') {
    if (!recipe.usage.en) flag('info', 'Missing usage.en');
    if (!recipe.usage.zh) flag('info', 'Missing usage.zh');
  }
  if (recipe.notes) {
    if (typeof recipe.notes === 'string') flag('warnings', 'notes is a string, should be { en, zh }');
    if (typeof recipe.notes === 'object') {
      if (!recipe.notes.en) flag('info', 'Missing notes.en');
      if (!recipe.notes.zh) flag('info', 'Missing notes.zh');
    }
  }

  // DOI format
  if (recipe.doi) {
    if (!/^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(recipe.doi)) {
      flag('warnings', `DOI format looks invalid: ${recipe.doi}`);
    }
  }

  // Per-category requirements
  if (cat === 'protocol') {
    checkProtocol(recipe, file, flag);
  } else if (cat === 'buffer' || cat === 'staining' || cat === 'media') {
    checkReagent(recipe, file, cat, flag);
  } else if (cat) {
    flag('warnings', `Unknown category '${cat}'`);
  }

  // crosslinks / relatedProtocols
  if (!recipe.crosslinks || recipe.crosslinks.length === 0) {
    flag('info', 'No crosslinks — consider adding related recipe IDs');
  }

  // discipline
  if (!recipe.discipline || recipe.discipline.length === 0) {
    flag('info', 'No discipline tags — add at least one');
  }

  return issues;
}

function checkProtocol(recipe, file, flag) {
  const comps = recipe.components || [];
  const hasStepComp = comps.some(c => c.unit === 'step');
  const hasDetailed = recipe.detailedSteps && recipe.detailedSteps.length > 0;
  const hasBrief = recipe.briefSteps && recipe.briefSteps.length > 0;

  if (!hasStepComp && !hasDetailed) {
    flag('errors', 'Protocol has no step-type components AND no detailedSteps — must have one or both');
  }
  if (!hasDetailed) {
    flag('warnings', 'Protocol has no detailedSteps — users miss out on step-by-step + timer/temp');
  }
  if (!hasBrief) {
    flag('warnings', 'Protocol has no briefSteps — add a one-liner TL;DR');
  }

  if (recipe.detailedSteps) {
    recipe.detailedSteps.forEach((s, i) => {
      if (!s.en || !s.zh) flag('errors', `detailedSteps[${i}] missing en or zh`);
      if (s.time && !/^[0-9].*?(min|h|s|sec|hour|day|week|overnight|o\/n)/i.test(s.time)) {
        flag('info', `detailedSteps[${i}].time unusual format: "${s.time}"`);
      }
    });
  }

  if (!recipe.materials || recipe.materials.length === 0) {
    flag('warnings', 'Protocol has no materials list');
  } else {
    recipe.materials.forEach((m, i) => {
      if (m.linkedRecipe) {
        if (!/^[a-z0-9_]+$/.test(m.linkedRecipe)) {
          flag('warnings', `materials[${i}].linkedRecipe has unusual format: ${m.linkedRecipe}`);
        }
      }
    });
  }

  if (!recipe.safeStops || recipe.safeStops.length === 0) {
    flag('info', 'No safeStops — add pause points for multi-day protocols');
  }

  if (!recipe.duration || !recipe.duration.total) {
    flag('warnings', 'No duration.total — users want to know time commitment');
  }

  if (!recipe.ref) {
    flag('warnings', 'No ref — protocol needs a credible source citation');
  }
}

function checkReagent(recipe, file, cat, flag) {
  if (!recipe.storage) {
    flag('warnings', `${cat} has no storage info`);
  } else {
    if (!recipe.storage.temperature) flag('info', 'storage.temperature missing');
    if (!recipe.storage.duration) flag('info', 'storage.duration missing');
  }

  if (!recipe.volume) {
    flag('info', `${cat} has no default volume`);
  }

  if (cat === 'buffer' || cat === 'staining') {
    if (!recipe.ref) {
      flag('info', `${cat} has no ref — even standard buffers benefit from a citation (Cold Spring Harbor Protocols etc.)`);
    }
  }

  // Components sanity
  const comps = recipe.components || [];
  comps.forEach((c, i) => {
    if (c.unit === 'step') {
      flag('warnings', `components[${i}] has unit "step" — this is for protocols, not ${cat}`);
    }
    if (c.amount !== undefined && c.amount !== null && typeof c.amount !== 'number') {
      flag('errors', `components[${i}].amount must be a number, got ${typeof c.amount}`);
    }
  });

  if (!recipe.prepSteps || recipe.prepSteps.length === 0) {
    flag('info', `${cat} has no prepSteps — add preparation instructions`);
  }
}

// ─── File enumeration ───────────────────────────────────────────────────────

function listAllRecipes() {
  const out = [];
  for (const [cat, dir] of Object.entries(CAT_DIRS)) {
    const dirPath = path.join(RECIPES_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()) {
      const fp = path.join(dirPath, f);
      try {
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        out.push({ file: fp, relFile: `recipes/${dir}/${f}`, data });
      } catch (e) {
        out.push({ file: fp, relFile: `recipes/${dir}/${f}`, data: null, parseError: e.message });
      }
    }
  }
  return out;
}

function findRecipe(query) {
  if (!query) return null;
  // Try direct file path
  if (fs.existsSync(query)) {
    try {
      return { file: query, relFile: path.relative(REPO_PATH, query), data: JSON.parse(fs.readFileSync(query, 'utf8')) };
    } catch (e) { return null; }
  }
  // Try with/without .json
  for (const dir of Object.values(CAT_DIRS)) {
    for (const candidate of [`${query}.json`, query]) {
      const fp = path.join(RECIPES_DIR, dir, candidate);
      if (fs.existsSync(fp)) {
        try {
          return { file: fp, relFile: path.relative(REPO_PATH, fp), data: JSON.parse(fs.readFileSync(fp, 'utf8')) };
        } catch (e) { return null; }
      }
    }
  }
  // Try by id search
  for (const r of listAllRecipes()) {
    if (r.data && r.data.id === query) return r;
  }
  return null;
}

// ─── Reporting ──────────────────────────────────────────────────────────────

function color(s, c) {
  if (!process.stdout.isTTY) return s;
  const codes = { red: 31, yellow: 33, cyan: 36, gray: 90, green: 32, bold: 1, reset: 0 };
  return `\x1b[${codes[c] || 0}m${s}\x1b[0m`;
}

function printReport(results, opts) {
  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  let errs = 0, warns = 0, infos = 0;
  for (const r of results) {
    for (const i of r.issues.errors) errs++;
    for (const i of r.issues.warnings) warns++;
    for (const i of r.issues.info) infos++;
  }

  console.log(`\n🔍 QC Report — ${results.length} recipe(s) reviewed\n`);
  console.log(`  ${color('Errors:', 'red')}   ${errs}`);
  console.log(`  ${color('Warnings:', 'yellow')} ${warns}`);
  console.log(`  ${color('Info:', 'cyan')}     ${infos}\n`);

  const failed = results.filter(r => r.issues.errors.length > 0 || (opts.strict && r.issues.warnings.length > 0));

  if (failed.length === 0) {
    console.log(color('✅ All recipes pass QC!', 'green'));
    return 0;
  }

  for (const r of failed) {
    const label = r.parseError ? color('PARSE', 'red') : (r.data?.name || r.relFile);
    console.log(color(`━━ ${label} (${r.relFile})`, 'bold'));
    for (const i of r.issues.errors) console.log(`  ${color('✖', 'red')} ${i.msg}`);
    for (const i of r.issues.warnings) console.log(`  ${color('⚠', 'yellow')} ${i.msg}`);
    for (const i of r.issues.info) console.log(`  ${color('ℹ', 'cyan')} ${i.msg}`);
    console.log();
  }

  return errs > 0 || (opts.strict && warns > 0) ? 1 : 0;
}

function writeHtmlReport(results, outPath) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const row = (r) => {
    const status = r.issues.errors.length ? '❌' : r.issues.warnings.length ? '⚠️' : '✅';
    return `<tr>
      <td>${status}</td>
      <td><a href="#${esc(r.relFile)}">${esc(r.data?.name || r.relFile)}</a></td>
      <td>${esc(r.data?.category || '-')}</td>
      <td>${r.issues.errors.length}</td>
      <td>${r.issues.warnings.length}</td>
      <td>${r.issues.info.length}</td>
    </tr>`;
  };
  const detail = (r) => {
    const items = [];
    for (const i of [...r.issues.errors, ...r.issues.warnings, ...r.issues.info]) {
      const c = i.level === 'ERROR' ? '#fdd' : i.level === 'WARN' ? '#ffd' : '#eef';
      items.push(`<li style="background:${c}"><b>${esc(i.level)}</b>: ${esc(i.msg)}</li>`);
    }
    return `<details id="${esc(r.relFile)}"><summary>${esc(r.relFile)} (${r.issues.errors.length}E/${r.issues.warnings.length}W/${r.issues.info.length}I)</summary><ul>${items.join('')}</ul></details>`;
  };
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>QC Report</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:1100px;margin:30px auto;padding:0 20px}
  table{border-collapse:collapse;width:100%;margin:20px 0}
  th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
  th{background:#f5f5f5}
  tr:nth-child(even){background:#fafafa}
  details{margin:8px 0;border:1px solid #eee;border-radius:4px;padding:6px 10px}
  summary{cursor:pointer;font-weight:500}
  ul{margin:6px 0;padding-left:20px}
  li{padding:2px 6px;margin:2px 0;border-radius:3px}
</style></head><body>
<h1>LabMate Recipe QC Report</h1>
<p>Generated: ${new Date().toISOString()}</p>
<h2>Summary</h2>
<table><thead><tr><th></th><th>Recipe</th><th>Category</th><th>Errors</th><th>Warnings</th><th>Info</th></tr></thead>
<tbody>${results.map(row).join('\n')}</tbody></table>
<h2>Details</h2>
${results.map(detail).join('\n')}
</body></html>`;
  fs.writeFileSync(outPath, html);
  console.log(`📄 Report written to ${outPath}`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const opts = { json: false, strict: false, llm: false, all: false, report: false };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opts.json = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--llm') opts.llm = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--report') opts.report = true;
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else positional.push(a);
  }

  let toCheck;
  if (opts.all || positional.length === 0) {
    toCheck = listAllRecipes();
  } else {
    toCheck = [];
    for (const q of positional) {
      const r = findRecipe(q);
      if (!r) {
        console.error(`❌ Recipe not found: ${q}`);
        process.exit(2);
      }
      toCheck.push(r);
    }
  }

  // Skip ones with parse errors for now
  const results = [];
  for (const r of toCheck) {
    if (r.parseError) {
      results.push({
        ...r,
        issues: { errors: [{ level: 'ERROR', file: r.relFile, msg: `Invalid JSON: ${r.parseError}` }], warnings: [], info: [] },
      });
      continue;
    }
    results.push({ ...r, issues: checkRecipe(r.data, r.file) });
  }

  // Sort: errors first, then warnings, then info
  results.sort((a, b) =>
    (b.issues.errors.length - a.issues.errors.length) ||
    (b.issues.warnings.length - a.issues.warnings.length) ||
    a.relFile.localeCompare(b.relFile)
  );

  if (opts.llm) {
    console.error('⚠️  --llm flag detected. This tool does not auto-spawn agents.');
    console.error('   For semantic review, run: node qc-llm.js <recipe-id>');
    console.error('   (This is a deliberate design choice — see QC_GUIDELINES.md §6)');
  }

  const exitCode = printReport(results, opts);
  if (opts.report) writeHtmlReport(results, 'qc-report.html');
  process.exit(exitCode);
}

function printUsage() {
  console.log(`labmate-recipes QC tool

Usage:
  node qc.js [recipe-id ...]    QC specified recipes (or all if none)
  node qc.js --all              QC all recipes
  node qc.js --strict           Treat warnings as failures
  node qc.js --json             Machine-readable JSON output
  node qc.js --report           Write HTML report to qc-report.html

Semantic / LLM review (reference realism, scientific accuracy):
  node qc-llm.js <recipe-id>    Spawn a sub-agent for in-depth review
  node qc-llm.js --all          Review all recipes (slow, ~minutes each)
  See QC_GUIDELINES.md for the full QC criteria and the LLM review procedure.

Repo: ${REPO_PATH}
`);
}

main();
