#!/usr/bin/env node
/**
 * merge-recipes.js — Merge repo v2 recipes with existing app recipes.json
 * 
 * For overlapping recipes: existing app data takes precedence for
 * detailedSteps, briefSteps, materials, safeStops (manually curated).
 * Repo data fills in new fields: discipline, usage, storage, prepSteps, crosslinks.
 * 
 * For new recipes: repo data is converted to app format.
 * 
 * Usage:
 *   node merge-recipes.js --existing /path/to/current/recipes.json --repo /path/to/repo --out /path/to/merged.json
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

const EXISTING_PATH = getArg('--existing') || '/var/www/apps.bioinfospace.com/labmate/recipes.json';
const REPO_PATH = getArg('--repo') || path.join(__dirname);
const OUT_PATH = getArg('--out') || path.join(__dirname, 'dist', 'recipes.json');

// Load the build-recipes converter
const { convertRecipe } = (() => {
  // Inline the converter to avoid module issues
  const CAT_DIRS = { buffer: 'buffers', protocol: 'protocols', media: 'media', staining: 'staining' };
  const DEFAULT_VOLUMES = {
    buffer: { volume: 1000, unit: 'mL' },
    staining: { volume: 100, unit: 'mL' },
    media: { volume: 500, unit: 'mL' },
    protocol: { volume: 1, unit: 'reaction' },
  };

  function readRepoRecipes() {
    const recipes = [];
    for (const [cat, dir] of Object.entries(CAT_DIRS)) {
      const dirPath = path.join(REPO_PATH, 'recipes', dir);
      if (!fs.existsSync(dirPath)) continue;
      for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()) {
        recipes.push(JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8')));
      }
    }
    return recipes;
  }

  return { readRepoRecipes };
})();

// Load build-recipes.js converter
const buildRecipes = require('./build-recipes.js');

// ─── Main ──────────────────────────────────────

// Actually, let's just do it inline since build-recipes.js doesn't export

const CAT_DIRS = { buffer: 'buffers', protocol: 'protocols', media: 'media', staining: 'staining' };
const DEFAULT_VOLUMES = {
  buffer: { volume: 1000, unit: 'mL' },
  staining: { volume: 100, unit: 'mL' },
  media: { volume: 500, unit: 'mL' },
  protocol: { volume: 1, unit: 'reaction' },
};

function convertRepoRecipe(repo) {
  const cat = repo.category;
  const isProtocol = cat === 'protocol';
  const defaults = DEFAULT_VOLUMES[cat] || DEFAULT_VOLUMES.buffer;

  const app = {
    id: repo.id,
    name: repo.name,
    nameCn: repo.nameCn || repo.name,
    category: repo.category,
    tags: repo.tags || [],
    defaultVolume: repo.volume || defaults.volume,
    unit: repo.volumeUnit || defaults.unit,
  };

  if (repo.ph) app.ph = repo.ph;
  app.components = (repo.components || []);
  if (repo.notes) app.notes = repo.notes;
  app.ref = repo.ref || '';
  if (repo.usage) app.usage = typeof repo.usage === 'string' ? { en: repo.usage, zh: repo.usage } : repo.usage;

  if (repo.storage) {
    const s = repo.storage;
    const tempIcons = { 'RT': '🏠', '4°C': '❄️', '-20°C': '🧊', '-80°C': '🧊', '-196°C': '🧊' };
    const icon = tempIcons[s.temperature] || '📋';
    const sterileText = { 'autoclave': 'autoclave', 'filter_022': '0.22 µm filter', 'filter_045': '0.45 µm filter', 'not_required': '' };
    const sterile = sterileText[s.sterile] || '';
    let labelEn = `${s.temperature || 'RT'}, ${s.duration || 'stable'}`;
    let labelZh = `${s.temperature || '室温'}, ${s.duration || '稳定'}`;
    if (sterile) { labelEn += ` (${sterile})`; labelZh += ` (${sterile === 'autoclave' ? '高压灭菌' : sterile})`; }
    if (s.notes) labelEn += `; ${s.notes}`;
    app.storage = { temp: s.temperature || 'RT', duration: s.duration || 'stable', icon, label: { en: labelEn, zh: labelZh } };
  }

  if (repo.discipline) app.discipline = repo.discipline;
  if (repo.relatedProtocols && repo.relatedProtocols.length > 0) app.relatedProtocols = repo.relatedProtocols;
  else if (repo.crosslinks && repo.crosslinks.length > 0) app.relatedProtocols = repo.crosslinks;
  if (repo.doi) app.doi = repo.doi;

  if (!isProtocol && repo.prepSteps && repo.prepSteps.length > 0) {
    // If prepSteps are already bilingual {en, zh}, pass through; otherwise convert
    if (repo.prepSteps[0] && repo.prepSteps[0].en) {
      app.prepSteps = repo.prepSteps;
    } else {
      app.prepSteps = repo.prepSteps.map(ps => {
        let en = ps.step || '';
        if (ps.note) en += ` (${ps.note})`;
        if (ps.warning) en += ` ⚠️ ${ps.warning}`;
        return { en, zh: en };
      });
    }
  }

  if (isProtocol) {
    if (repo.duration) {
      const dur = repo.duration;
      app.storage = {
        temp: 'N/A', duration: dur.total || '~1 day', icon: '📋',
        label: {
          en: `Protocol — ${dur.total || '~1 day'}${dur.hands_on ? `, hands-on: ${dur.hands_on}` : ''}`,
          zh: `实验方案 — ${dur.total || '~1 天'}${dur.hands_on ? `，实操: ${dur.hands_on}` : ''}`,
        },
      };
    }
    if (repo.materials && repo.materials.length > 0) {
      app.materials = repo.materials.map(m => ({ name: m.name, ...(m.linkedRecipe ? { linkedRecipe: m.linkedRecipe } : {}), ...(m.optional ? { optional: true } : {}) }));
    }
    if (repo.stoppingPoints && repo.stoppingPoints.length > 0 && !repo.safeStops) {
      app.safeStops = repo.stoppingPoints.map(sp => ({
        afterStep: sp.afterStep,
        note: { en: `${sp.condition || ''}${sp.duration ? ` (up to ${sp.duration})` : ''}`.trim(), zh: `${sp.condition || ''}${sp.duration ? ` (最长 ${sp.duration})` : ''}`.trim() },
      }));
    }
    // Pass through v2 fields directly if present
    if (repo.safeStops && repo.safeStops.length > 0) app.safeStops = repo.safeStops;
    if (repo.detailedSteps && repo.detailedSteps.length > 0) app.detailedSteps = repo.detailedSteps;
    if (repo.briefSteps && repo.briefSteps.length > 0) app.briefSteps = repo.briefSteps;
  }

  return app;
}

function readRepoRecipes() {
  const recipes = [];
  for (const [cat, dir] of Object.entries(CAT_DIRS)) {
    const dirPath = path.join(REPO_PATH, 'recipes', dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()) {
      recipes.push(JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8')));
    }
  }
  return recipes;
}

// ─── Merge ──────────────────────────────────────

const existing = JSON.parse(fs.readFileSync(EXISTING_PATH, 'utf8'));
const existingMap = new Map(existing.map(r => [r.id, r]));

const repoRecipes = readRepoRecipes();
const merged = [];
const seen = new Set();

// Process existing recipes first (preserve order)
for (const ex of existing) {
  const repo = repoRecipes.find(r => r.id === ex.id);
  if (repo) {
    const converted = convertRepoRecipe(repo);
    // Existing app data takes precedence for curated fields
    const result = { ...converted };
    
    // Keep existing curated fields if they exist
    if (ex.detailedSteps) result.detailedSteps = ex.detailedSteps;
    if (ex.briefSteps) result.briefSteps = ex.briefSteps;
    if (ex.materials && ex.materials.length > 0) result.materials = ex.materials;
    if (ex.safeStops && ex.safeStops.length > 0) result.safeStops = ex.safeStops;
    if (ex.prepSteps && ex.prepSteps.length > 0) result.prepSteps = ex.prepSteps;
    if (ex.relatedProtocols && ex.relatedProtocols.length > 0 && !result.relatedProtocols) {
      result.relatedProtocols = ex.relatedProtocols;
    }
    // Keep existing defaultVolume/unit if repo doesn't specify
    if (ex.defaultVolume && !repo.volume) result.defaultVolume = ex.defaultVolume;
    if (ex.unit && !repo.volumeUnit) result.unit = ex.unit;
    if (ex.ph) result.ph = ex.ph;
    
    merged.push(result);
  } else {
    merged.push(ex); // Keep as-is if not in repo
  }
  seen.add(ex.id);
}

// Add new recipes from repo
let added = 0;
for (const repo of repoRecipes) {
  if (!seen.has(repo.id)) {
    merged.push(convertRepoRecipe(repo));
    seen.add(repo.id);
    added++;
  }
}

// Sort: buffers first, then media, staining, protocols
const catOrder = { buffer: 0, media: 1, staining: 2, protocol: 3 };
merged.sort((a, b) => (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) || a.name.localeCompare(b.name));

// Write
const outDir = path.dirname(OUT_PATH);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 0));

console.log(`✅ Merged ${merged.length} recipes → ${OUT_PATH}`);
console.log(`   From existing: ${existing.length}`);
console.log(`   From repo: ${repoRecipes.length}`);
console.log(`   New additions: ${added}`);
console.log(`   Buffers: ${merged.filter(r => r.category === 'buffer').length}`);
console.log(`   Media: ${merged.filter(r => r.category === 'media').length}`);
console.log(`   Staining: ${merged.filter(r => r.category === 'staining').length}`);
console.log(`   Protocols: ${merged.filter(r => r.category === 'protocol').length}`);
