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
 * Convert repo v2 recipe → app format
 */
function convertRecipe(repo) {
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

  // pH (extract from notes if present)
  if (repo.ph) app.ph = repo.ph;

  // Components
  app.components = (repo.components || []).map(c => {
    const comp = { name: c.name };
    if (c.amount != null) comp.amount = c.amount;
    if (c.unit) comp.unit = c.unit;
    if (c.mw) comp.mw = c.mw;
    if (c.concentration) comp.concentration = c.concentration;
    if (c.note) comp.note = c.note;
    if (c.linkedRecipe) comp.linkedRecipe = c.linkedRecipe;
    if (c.optional) comp.optional = c.optional;
    return comp;
  });

  // Notes
  if (repo.notes) app.notes = repo.notes;
  app.ref = repo.ref || '';

  // Usage (bilingual)
  if (repo.usage) {
    if (typeof repo.usage === 'string') {
      app.usage = { en: repo.usage, zh: repo.usage };
    } else {
      app.usage = repo.usage;
    }
  }

  // Storage → app format {temp, duration, icon, label}
  if (repo.storage) {
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

  // Discipline tags (new v2 field → pass through)
  if (repo.discipline) app.discipline = repo.discipline;

  // Crosslinks → relatedProtocols (for buffers)
  if (repo.crosslinks && repo.crosslinks.length > 0) {
    app.relatedProtocols = repo.crosslinks;
  }

  // DOI
  if (repo.doi) app.doi = repo.doi;

  // ── Buffer-specific ──
  if (!isProtocol) {
    // prepSteps: convert {step, note, warning} → {en, zh}
    if (repo.prepSteps && repo.prepSteps.length > 0) {
      app.prepSteps = repo.prepSteps.map(ps => {
        let en = ps.step || '';
        let zh = ps.step || ''; // Use English as fallback for Chinese
        if (ps.note) en += ` (${ps.note})`;
        if (ps.warning) en += ` ⚠️ ${ps.warning}`;
        return { en, zh };
      });
    }
  }

  // ── Protocol-specific ──
  if (isProtocol) {
    // Duration → storage label format
    if (repo.duration) {
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

    // Materials
    if (repo.materials && repo.materials.length > 0) {
      app.materials = repo.materials.map(m => {
        const mat = { name: m.name };
        if (m.linkedRecipe) mat.linkedRecipe = m.linkedRecipe;
        if (m.optional) mat.optional = m.optional;
        return mat;
      });
    }

    // stoppingPoints → safeStops
    if (repo.stoppingPoints && repo.stoppingPoints.length > 0) {
      app.safeStops = repo.stoppingPoints.map(sp => ({
        afterStep: typeof sp.afterStep === 'number' ? sp.afterStep : sp.afterStep,
        note: {
          en: `${sp.condition || ''}${sp.duration ? ` (up to ${sp.duration})` : ''}`.trim(),
          zh: `${sp.condition || ''}${sp.duration ? ` (最长 ${sp.duration})` : ''}`.trim(),
        },
      }));
    }

    // briefSteps (if present in repo — some protocols may have them)
    if (repo.briefSteps) app.briefSteps = repo.briefSteps;

    // detailedSteps (keep as-is if present)
    if (repo.detailedSteps) app.detailedSteps = repo.detailedSteps;
  }

  return app;
}

// ─── Main ──────────────────────────────────────

function main() {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : DEFAULT_OUT;

  const recipes = [];
  for (const [cat, dir] of Object.entries(CAT_DIRS)) {
    const dirPath = path.join(RECIPES_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter(f => f.endsWith('.json')).sort()) {
      const data = JSON.parse(fs.readFileSync(path.join(dirPath, file), 'utf8'));
      recipes.push(convertRecipe(data));
    }
  }

  // Sort: buffers first, then media, staining, protocols
  const catOrder = { buffer: 0, media: 1, staining: 2, protocol: 3 };
  recipes.sort((a, b) => (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) || a.name.localeCompare(b.name));

  // Ensure output directory exists
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outPath, JSON.stringify(recipes, null, 0));
  console.log(`✅ Built ${recipes.length} recipes → ${outPath}`);
  console.log(`   Buffers: ${recipes.filter(r => r.category === 'buffer').length}`);
  console.log(`   Media: ${recipes.filter(r => r.category === 'media').length}`);
  console.log(`   Staining: ${recipes.filter(r => r.category === 'staining').length}`);
  console.log(`   Protocols: ${recipes.filter(r => r.category === 'protocol').length}`);
}

main();
