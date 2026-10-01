#!/usr/bin/env node
/**
 * build-recipes.js — Convert repo v2 JSON → app recipes.json
 * 
 * Reads all recipe files from recipes/ and produces a single
 * recipes.json in the app's expected format.
 * 
 * Usage:
 *   node build-recipes.js [--out /path/to/recipes.json]
 */

const fs = require('fs');
const path = require('path');

const REPO_PATH = process.env.LABMATE_REPO || __dirname;
const RECIPES_DIR = path.join(REPO_PATH, 'recipes');
const DEFAULT_OUT = path.join(REPO_PATH, 'dist', 'recipes.json');
const ORDER_FILE = path.join(REPO_PATH, 'order.json'); // list order shown in the app

// Category → subfolder
const CAT_DIRS = {
  buffer: 'buffers',
  protocol: 'protocols',
  media: 'media',
  staining: 'staining',
};

// Default volumes by category if not specified
const DEFAULT_VOLUMES = {
  buffer: { volume: 1000, unit: 'mL' },
  staining: { volume: 100, unit: 'mL' },
  media: { volume: 500, unit: 'mL' },
  protocol: { volume: 1, unit: 'reaction' },
};

/**
 * Convert one source recipe → the app's record.
 *
 * Lossless: a field already written in the app's own shape is passed through
 * unchanged (bilingual {en, zh} prepSteps, `safeStops`, app-shaped `storage`
 * with a `label`, every key of a component or material), so curated app data
 * can live in the source file. Fields in the v2 authoring shape are converted
 * exactly as before. The published library is therefore fully determined by
 * the files in recipes/ — there is no second copy to merge with.
 */
function convertRecipe(repo) {
  const cat = repo.category;
  const isProtocol = cat === 'protocol';
  const defaults = DEFAULT_VOLUMES[cat] || DEFAULT_VOLUMES.buffer;
  const has = (v) => Array.isArray(v) ? v.length > 0 : v != null && v !== '';

  const app = {
    id: repo.id,
    name: repo.name,
    nameCn: repo.nameCn || repo.name,
    category: repo.category,
    tags: repo.tags || [],
    defaultVolume: repo.defaultVolume ?? repo.volume ?? defaults.volume,
    unit: repo.unit || repo.volumeUnit || defaults.unit,
  };

  if (repo.ph) app.ph = repo.ph;

  // Components: every key passes through (note may be a string or {en, zh}).
  app.components = (repo.components || []).map((c) => ({ ...c }));

  if (repo.notes) app.notes = repo.notes;
  app.ref = repo.ref || '';

  if (repo.usage) {
    app.usage = typeof repo.usage === 'string' ? { en: repo.usage, zh: repo.usage } : repo.usage;
  }

  // Storage: app-shaped ({temp, duration, icon, label}) passes through;
  // the v2 shape ({temperature, duration, sterile, notes}) is converted.
  const appStorage = repo.storage && repo.storage.label ? { ...repo.storage } : null;
  if (appStorage) {
    app.storage = appStorage;
  } else if (repo.storage) {
    const s = repo.storage;
    const tempIcons = {
      'RT': '🏠', 'room temperature': '🏠',
      '4°C': '❄️', '4 °C': '❄️',
      '-20°C': '🧊', '-20 °C': '🧊',
      '-80°C': '🧊', '-80 °C': '🧊',
      '-196°C': '🧊',
    };
    const icon = tempIcons[s.temperature] || '📋';
    const sterileText = {
      'autoclave': 'autoclave',
      'filter_022': '0.22 µm filter',
      'filter_045': '0.45 µm filter',
      'not_required': '',
    };
    const sterile = sterileText[s.sterile] || '';

    let labelEn = `${s.temperature || 'RT'}, ${s.duration || 'stable'}`;
    let labelZh = `${s.temperature || '室温'}, ${s.duration || '稳定'}`;
    if (sterile) {
      labelEn += ` (${sterile})`;
      labelZh += ` (${sterile === 'autoclave' ? '高压灭菌' : sterile})`;
    }
    if (s.notes) {
      labelEn += `; ${s.notes}`;
    }

    app.storage = {
      temp: s.temperature || 'RT',
      duration: s.duration || 'stable',
      icon,
      label: { en: labelEn, zh: labelZh },
    };
  }

  if (repo.discipline) app.discipline = repo.discipline;

  // Links: `crosslinks` (related protocols and buffers) first, then any further
  // `relatedProtocols`, without duplicates.
  const links = [...(repo.crosslinks || []), ...(repo.relatedProtocols || [])].filter((x, i, a) => a.indexOf(x) === i);
  if (links.length > 0) app.relatedProtocols = links;

  if (repo.doi) app.doi = repo.doi;

  // Buffer prep steps: {en, zh} items pass through; v2 {step, note, warning}
  // items are converted (English only — give them a zh to translate them).
  if (!isProtocol && has(repo.prepSteps)) {
    app.prepSteps = repo.prepSteps.map((ps) => {
      if (ps && (ps.en != null || ps.zh != null)) return ps;
      let en = ps.step || '';
      const zh = ps.step || '';
      if (ps.note) en += ` (${ps.note})`;
      if (ps.warning) en += ` ⚠️ ${ps.warning}`;
      return { en, zh };
    });
  }

  if (isProtocol) {
    // Protocol duration becomes the storage-row label, unless the file already
    // carries an app-shaped storage label.
    if (repo.duration && !appStorage) {
      const dur = repo.duration;
      const totalEn = dur.total || '~1 day';
      const totalZh = dur.total || '~1 天';
      const handsOn = dur.hands_on ? `, hands-on: ${dur.hands_on}` : '';
      app.storage = {
        temp: 'N/A',
        duration: totalEn,
        icon: '📋',
        label: {
          en: `Protocol — ${totalEn}${handsOn}`,
          zh: `实验方案 — ${totalZh}${handsOn ? `，实操: ${dur.hands_on}` : ''}`,
        },
      };
    }

    if (has(repo.materials)) app.materials = repo.materials.map((m) => (typeof m === 'string' ? { name: m } : { ...m }));

    // safeStops pass through; legacy stoppingPoints are converted.
    if (has(repo.safeStops)) {
      app.safeStops = repo.safeStops;
    } else if (has(repo.stoppingPoints)) {
      app.safeStops = repo.stoppingPoints.map((sp) => ({
        afterStep: sp.afterStep,
        note: {
          en: `${sp.condition || ''}${sp.duration ? ` (up to ${sp.duration})` : ''}`.trim(),
          zh: `${sp.condition || ''}${sp.duration ? ` (最长 ${sp.duration})` : ''}`.trim(),
        },
      }));
    }

    if (repo.briefSteps) app.briefSteps = repo.briefSteps;
    if (repo.detailedSteps) app.detailedSteps = repo.detailedSteps;
  }

  return app;
}

/**
 * Every recipe in recipes/, converted and in published order: buffers, media,
 * staining, protocols; within a category, the order listed in order.json (the
 * order the app shows its lists in), then any recipe not listed there, by name.
 */
function buildLibrary(recipesDir = RECIPES_DIR, orderFile = ORDER_FILE) {
  const recipes = [];
  for (const dir of Object.values(CAT_DIRS)) {
    const dirPath = path.join(recipesDir, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter((f) => f.endsWith('.json')).sort()) {
      recipes.push(convertRecipe(JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'))));
    }
  }
  const listed = fs.existsSync(orderFile) ? JSON.parse(fs.readFileSync(orderFile, 'utf8')) : [];
  const rank = new Map(listed.map((id, i) => [id, i]));
  const catOrder = { buffer: 0, media: 1, staining: 2, protocol: 3 };
  recipes.sort((a, b) => (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9)
    || (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return recipes;
}

// ─── Main ──────────────────────────────────────

function main() {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : DEFAULT_OUT;
  const recipes = buildLibrary();

  const ids = new Set();
  for (const r of recipes) {
    if (ids.has(r.id)) { console.error(`Duplicate recipe id: ${r.id}`); process.exit(1); }
    ids.add(r.id);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(recipes, null, 0));
  console.log(`✅ Built ${recipes.length} recipes → ${outPath}`);
  console.log(`   Buffers: ${recipes.filter(r => r.category === 'buffer').length}`);
  console.log(`   Media: ${recipes.filter(r => r.category === 'media').length}`);
  console.log(`   Staining: ${recipes.filter(r => r.category === 'staining').length}`);
  console.log(`   Protocols: ${recipes.filter(r => r.category === 'protocol').length}`);
}

module.exports = { convertRecipe, buildLibrary };

if (require.main === module) main();
