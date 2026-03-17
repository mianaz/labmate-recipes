#!/usr/bin/env node
/**
 * labmate-recipes ↔ web app sync tool
 *
 * Usage:
 *   node sync.js export   — Extract recipes from live index.html → repo JSON files
 *   node sync.js import   — Merge repo JSON files → live index.html
 *   node sync.js diff     — Show what's different between repo and web app
 *   node sync.js validate — Check all JSON files for schema issues
 *
 * Config (env vars or edit below):
 *   LABMATE_HTML  — path to live index.html
 *   LABMATE_REPO  — path to recipes repo root
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = process.env.LABMATE_HTML || '/var/www/apps.bioinfospace.com/labmate/index.html';
const REPO_PATH = process.env.LABMATE_REPO || path.dirname(__filename);
const RECIPES_DIR = path.join(REPO_PATH, 'recipes');

// Category → subfolder mapping
const CAT_DIRS = {
  buffer: 'buffers',
  protocol: 'protocols',
  media: 'media',
  staining: 'staining',
};

// ─── Helpers ────────────────────────────────────────────

function readHTML() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function writeHTML(content) {
  fs.writeFileSync(HTML_PATH, content, 'utf8');
}

/**
 * Parse the `const RECIPES = [...]` array from the HTML.
 * Returns { startIdx, endIdx, recipes[] }
 */
function extractRecipesFromHTML(html) {
  const marker = 'const RECIPES = [';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) throw new Error('Cannot find "const RECIPES = [" in HTML');

  // Find matching ];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let endIdx = -1;

  for (let i = startIdx + marker.length - 1; i < html.length; i++) {
    const ch = html[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1; // after ']'
        // skip the semicolon if present
        if (html[endIdx] === ';') endIdx++;
        break;
      }
    }
  }
  if (endIdx === -1) throw new Error('Cannot find end of RECIPES array');

  // Extract the JS array text and eval it
  const arrayText = html.slice(startIdx + 'const RECIPES = '.length, endIdx).replace(/;$/, '');

  // We can't JSON.parse JS objects (unquoted keys, trailing commas).
  // Use Function constructor to safely evaluate.
  const recipes = new Function(`return ${arrayText}`)();
  return { startIdx, endIdx, recipes };
}

/**
 * Read all JSON recipe files from the repo
 */
function readRepoRecipes() {
  const recipes = [];
  for (const [cat, dir] of Object.entries(CAT_DIRS)) {
    const dirPath = path.join(RECIPES_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()) {
      const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
      recipes.push(data);
    }
  }
  return recipes;
}

/**
 * Convert a recipe object to JS source (with unquoted keys for readability)
 */
function recipeToJS(recipe, indent = '  ') {
  return formatJSObject(recipe, indent, 1);
}

function formatJSObject(obj, baseIndent, level) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') return quoteJS(obj);

  const ind = baseIndent.repeat(level);
  const indInner = baseIndent.repeat(level + 1);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    // Short arrays of primitives on one line
    if (obj.every(v => typeof v !== 'object' || v === null) && JSON.stringify(obj).length < 80) {
      return '[' + obj.map(v => formatJSObject(v, baseIndent, 0)).join(', ') + ']';
    }
    const items = obj.map(v => indInner + formatJSObject(v, baseIndent, level + 1));
    return '[\n' + items.join(',\n') + '\n' + ind + ']';
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    // Compact single-line for small objects
    const oneLine = '{ ' + entries.map(([k, v]) => `${safeKey(k)}: ${formatJSObject(v, baseIndent, 0)}`).join(', ') + ' }';
    if (oneLine.length < 100 && !oneLine.includes('\n')) return oneLine;

    const lines = entries.map(([k, v]) => {
      return indInner + safeKey(k) + ': ' + formatJSObject(v, baseIndent, level + 1);
    });
    return '{\n' + lines.join(',\n') + '\n' + ind + '}';
  }
  return String(obj);
}

function safeKey(k) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : quoteJS(k);
}

function quoteJS(s) {
  // Use single quotes, escape internal single quotes
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

// ─── Commands ───────────────────────────────────────────

function cmdDiff() {
  const html = readHTML();
  const { recipes: webRecipes } = extractRecipesFromHTML(html);
  const repoRecipes = readRepoRecipes();

  const webMap = new Map(webRecipes.map(r => [r.id, r]));
  const repoMap = new Map(repoRecipes.map(r => [r.id, r]));

  const onlyWeb = [...webMap.keys()].filter(id => !repoMap.has(id));
  const onlyRepo = [...repoMap.keys()].filter(id => !webMap.has(id));
  const both = [...webMap.keys()].filter(id => repoMap.has(id));

  const changed = both.filter(id => {
    const w = JSON.stringify(webMap.get(id), null, 0);
    const r = JSON.stringify(repoMap.get(id), null, 0);
    return w !== r;
  });

  console.log(`Web app: ${webRecipes.length} recipes`);
  console.log(`Repo:    ${repoRecipes.length} recipes`);
  console.log(`Common:  ${both.length}`);
  console.log();

  if (onlyRepo.length) {
    console.log(`📦 Only in repo (${onlyRepo.length} — will be ADDED to web):`);
    onlyRepo.forEach(id => console.log(`  + ${id} (${repoMap.get(id).category})`));
    console.log();
  }
  if (onlyWeb.length) {
    console.log(`🌐 Only in web app (${onlyWeb.length} — not in repo):`);
    onlyWeb.forEach(id => console.log(`  - ${id} (${webMap.get(id).category})`));
    console.log();
  }
  if (changed.length) {
    console.log(`🔄 Changed (${changed.length} — repo version will overwrite web):`);
    changed.forEach(id => {
      const w = webMap.get(id);
      const r = repoMap.get(id);
      const diffs = [];
      if (JSON.stringify(w.components) !== JSON.stringify(r.components)) diffs.push('components');
      if (JSON.stringify(w.notes) !== JSON.stringify(r.notes)) diffs.push('notes');
      if (w.name !== r.name || w.nameCn !== r.nameCn) diffs.push('name');
      if (JSON.stringify(w.tags) !== JSON.stringify(r.tags)) diffs.push('tags');
      if (w.ref !== r.ref) diffs.push('ref');
      // catch-all
      if (diffs.length === 0) diffs.push('other fields');
      console.log(`  ~ ${id}: ${diffs.join(', ')}`);
    });
    console.log();
  }
  if (!onlyRepo.length && !onlyWeb.length && !changed.length) {
    console.log('✅ Everything in sync!');
  }

  return { onlyWeb, onlyRepo, changed };
}

function cmdImport() {
  console.log('🔄 Importing repo recipes → web app...\n');

  const html = readHTML();
  const { startIdx, endIdx, recipes: webRecipes } = extractRecipesFromHTML(html);
  const repoRecipes = readRepoRecipes();

  const webMap = new Map(webRecipes.map(r => [r.id, r]));
  const repoMap = new Map(repoRecipes.map(r => [r.id, r]));

  // Build merged list: start with web recipes (preserving order), update from repo, then append new
  const merged = [];
  const seen = new Set();

  for (const wr of webRecipes) {
    if (repoMap.has(wr.id)) {
      // Repo version takes precedence — merge fields
      const rr = repoMap.get(wr.id);
      // Keep web-only fields (like defaultVolume, ph, unit, relatedProtocols, etc.) that repo may lack
      const mergedRecipe = { ...wr, ...rr };
      // Preserve web-app-specific fields that repo shouldn't override
      if (wr.defaultVolume !== undefined && rr.defaultVolume === undefined) mergedRecipe.defaultVolume = wr.defaultVolume;
      if (wr.unit !== undefined && rr.unit === undefined) mergedRecipe.unit = wr.unit;
      if (wr.ph !== undefined && rr.ph === undefined) mergedRecipe.ph = wr.ph;
      if (wr.briefSteps && !rr.briefSteps) mergedRecipe.briefSteps = wr.briefSteps;
      if (wr.detailedSteps && !rr.detailedSteps) mergedRecipe.detailedSteps = wr.detailedSteps;
      if (wr.safeStops && !rr.safeStops) mergedRecipe.safeStops = wr.safeStops;
      if (wr.relatedProtocols && !rr.relatedProtocols) mergedRecipe.relatedProtocols = wr.relatedProtocols;
      // Ensure defaultVolume and unit always exist
      if (!mergedRecipe.defaultVolume) mergedRecipe.defaultVolume = mergedRecipe.category === 'protocol' ? 1 : 1000;
      if (!mergedRecipe.unit) mergedRecipe.unit = mergedRecipe.category === 'protocol' ? 'reaction' : 'mL';
      // Remove repo-only fields not used by web app
      delete mergedRecipe.source;
      merged.push(mergedRecipe);
    } else {
      merged.push(wr);
    }
    seen.add(wr.id);
  }

  // Append recipes only in repo (new additions)
  let added = 0;
  for (const rr of repoRecipes) {
    if (!seen.has(rr.id)) {
      const recipe = { ...rr };
      // Set defaults for missing fields based on category
      if (!recipe.defaultVolume) {
        recipe.defaultVolume = recipe.category === 'protocol' ? 1 : 1000;
      }
      if (!recipe.unit) {
        recipe.unit = recipe.category === 'protocol' ? 'reaction' : 'mL';
      }
      delete recipe.source;
      merged.push(recipe);
      seen.add(rr.id);
      added++;
    }
  }

  // Generate JS source for the merged RECIPES array
  const recipesJS = 'const RECIPES = [\n' +
    merged.map(r => '  ' + recipeToJS(r, '  ')).join(',\n') +
    '\n];';

  // Splice into HTML
  const newHTML = html.slice(0, startIdx) + recipesJS + html.slice(endIdx);
  writeHTML(newHTML);

  const updated = [...repoMap.keys()].filter(id => webMap.has(id) &&
    JSON.stringify(webMap.get(id)) !== JSON.stringify(repoMap.get(id))).length;

  console.log(`✅ Import complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Added:   ${added}`);
  console.log(`   Total:   ${merged.length} recipes in web app`);
}

function cmdExport() {
  console.log('📤 Exporting web app recipes → repo JSON...\n');

  const html = readHTML();
  const { recipes } = extractRecipesFromHTML(html);

  let created = 0;
  let updated = 0;

  for (const recipe of recipes) {
    const cat = recipe.category;
    const dir = CAT_DIRS[cat];
    if (!dir) {
      console.log(`  ⚠ Unknown category '${cat}' for ${recipe.id}, skipping`);
      continue;
    }
    const dirPath = path.join(RECIPES_DIR, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    const filePath = path.join(dirPath, `${recipe.id}.json`);
    const jsonData = { ...recipe };
    // Remove web-app-only rendering fields for clean repo storage
    // Keep: id, name, nameCn, category, tags, components, notes, ref, crosslinks
    // Remove: defaultVolume, unit, ph (buffer-specific, keep for buffers)
    // Remove: briefSteps, detailedSteps, safeStops, relatedProtocols (web-app specific)

    const existing = fs.existsSync(filePath);
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2) + '\n');
    if (existing) updated++;
    else created++;
  }

  console.log(`✅ Export complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total:   ${recipes.length} recipes exported`);
}

function cmdValidate() {
  console.log('🔍 Validating repo JSON files...\n');
  const issues = [];

  for (const [cat, dir] of Object.entries(CAT_DIRS)) {
    const dirPath = path.join(RECIPES_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()) {
      const filePath = path.join(dirPath, file);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        issues.push({ file, level: 'ERROR', msg: `Invalid JSON: ${e.message}` });
        continue;
      }

      // Required fields
      if (!data.id) issues.push({ file, level: 'ERROR', msg: 'Missing id' });
      if (!data.name) issues.push({ file, level: 'ERROR', msg: 'Missing name' });
      if (!data.category) issues.push({ file, level: 'ERROR', msg: 'Missing category' });
      if (!data.components || !data.components.length) issues.push({ file, level: 'WARN', msg: 'No components' });

      // id should match filename
      const expectedId = file.replace('.json', '');
      if (data.id !== expectedId) {
        issues.push({ file, level: 'WARN', msg: `id '${data.id}' doesn't match filename '${expectedId}'` });
      }

      // nameCn should exist
      if (!data.nameCn) issues.push({ file, level: 'WARN', msg: 'Missing nameCn' });

      // Notes should be bilingual object
      if (data.notes && typeof data.notes === 'string') {
        issues.push({ file, level: 'WARN', msg: 'notes is a string, should be { en, zh }' });
      }
      if (data.notes && typeof data.notes === 'object') {
        if (!data.notes.en) issues.push({ file, level: 'INFO', msg: 'Missing notes.en' });
        if (!data.notes.zh) issues.push({ file, level: 'INFO', msg: 'Missing notes.zh' });
      }

      // Protocols should have steps
      if (cat === 'protocol') {
        const hasSteps = data.components && data.components.some(c => c.unit === 'step');
        if (!hasSteps) issues.push({ file, level: 'WARN', msg: 'Protocol has no step-type components' });
      }

      // Ref should exist
      if (!data.ref) issues.push({ file, level: 'INFO', msg: 'Missing ref' });
    }
  }

  if (issues.length === 0) {
    console.log('✅ All files valid!');
  } else {
    const errors = issues.filter(i => i.level === 'ERROR');
    const warns = issues.filter(i => i.level === 'WARN');
    const infos = issues.filter(i => i.level === 'INFO');

    if (errors.length) {
      console.log(`❌ Errors (${errors.length}):`);
      errors.forEach(i => console.log(`  ${i.file}: ${i.msg}`));
      console.log();
    }
    if (warns.length) {
      console.log(`⚠️  Warnings (${warns.length}):`);
      warns.forEach(i => console.log(`  ${i.file}: ${i.msg}`));
      console.log();
    }
    if (infos.length) {
      console.log(`ℹ️  Info (${infos.length}):`);
      infos.forEach(i => console.log(`  ${i.file}: ${i.msg}`));
      console.log();
    }
  }
  return issues;
}

// ─── CLI ────────────────────────────────────────────────

const cmd = process.argv[2];
switch (cmd) {
  case 'diff':     cmdDiff(); break;
  case 'import':   cmdImport(); break;
  case 'export':   cmdExport(); break;
  case 'validate': cmdValidate(); break;
  default:
    console.log(`labmate-recipes sync tool

Usage:
  node sync.js diff       Show differences between repo and web app
  node sync.js import     Merge repo → web app (adds new, updates changed)
  node sync.js export     Export web app → repo JSON files
  node sync.js validate   Check all JSON files for issues

Paths:
  HTML: ${HTML_PATH}
  Repo: ${REPO_PATH}

Set LABMATE_HTML / LABMATE_REPO env vars to override.`);
}
