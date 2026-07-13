#!/usr/bin/env node
/**
 * LabMate ← protocols.io candidate fetcher
 *
 * Pulls the most-viewed public protocols from protocols.io for a curated set of
 * search terms, dedups them against the recipes already in this repo, and writes
 * a review report (JSON + Markdown). It NEVER writes into the recipe library —
 * every hit is a candidate for a human to review and hand to the labmate-recipe
 * generator skill.
 *
 * Usage:
 *   node fetch-candidates.js                 # all terms, default page size
 *   node fetch-candidates.js --per 5         # top-5 per term
 *   node fetch-candidates.js --term "ChIP"   # single ad-hoc term (repeatable)
 *   node fetch-candidates.js --min-views 500 # drop low-traffic protocols
 *   node fetch-candidates.js --json-only     # skip the Markdown report
 *
 * Output → tools/protocol-fetcher/out/candidates-YYYY-MM-DD.json  (+ .md)
 *
 * Auth: reads client_access_token from
 *   ~/.openclaw/workspace-webdev/secrets/protocols-io.json
 * (override with PROTOCOLS_IO_SECRET env var). protocols.io API is v3 — v4 has a
 * different required-param schema (see workspace TOOLS.md).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Config ─────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RECIPES_DIR = path.join(REPO_ROOT, 'recipes');
const OUT_DIR = path.join(__dirname, 'out');
const TERMS_FILE = path.join(__dirname, 'terms.json');
const SECRET_FILE = process.env.PROTOCOLS_IO_SECRET ||
  path.join(os.homedir(), '.openclaw', 'workspace-webdev', 'secrets', 'protocols-io.json');
const API_BASE = 'https://www.protocols.io/api/v3/protocols';

// ─── Args ───────────────────────────────────────────────
function parseArgs(argv) {
  const a = { per: 8, minViews: 0, jsonOnly: false, adHocTerms: [] };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--per') a.per = parseInt(argv[++i], 10);
    else if (k === '--min-views') a.minViews = parseInt(argv[++i], 10);
    else if (k === '--json-only') a.jsonOnly = true;
    else if (k === '--term') a.adHocTerms.push(argv[++i]);
    else if (k === '--help' || k === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown arg: ${k}`); process.exit(1); }
  }
  return a;
}
function printHelp() {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 24).join('\n').replace(/^ \* ?/gm, ''));
}

// ─── Normalization / dedup ──────────────────────────────
const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'to', 'in', 'with', 'using',
  'protocol', 'protocols', 'assay', 'method', 'procedure', 'kit', 'based', 'via', 'from',
  'v1', 'v2', 'v3', 'x', '1x', '5x', '10x']);

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[×µμ]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function tokenSet(s) {
  return new Set(normName(s).split(' ').filter(t => t && !STOP.has(t)));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function normDoi(s) {
  return String(s || '').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim();
}

// ─── Load existing library ──────────────────────────────
function loadExisting() {
  const files = [];
  for (const sub of fs.readdirSync(RECIPES_DIR)) {
    const dir = path.join(RECIPES_DIR, sub);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) files.push(path.join(dir, f));
    }
  }
  const entries = [];
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(f, 'utf8'));
      entries.push({
        id: r.id,
        name: r.name,
        nameCn: r.nameCn,
        doi: normDoi(r.doi),
        tokens: tokenSet(`${r.name} ${r.nameCn || ''}`),
      });
    } catch (e) { /* skip malformed */ }
  }
  return entries;
}

// Returns { verdict: 'new'|'likely-dup', match, score }
function classify(title, doi, existing) {
  const nd = normDoi(doi);
  if (nd) {
    const hit = existing.find(e => e.doi && e.doi === nd);
    if (hit) return { verdict: 'likely-dup', match: hit.name, score: 1, reason: 'doi' };
  }
  const t = tokenSet(title);
  let best = null, bestScore = 0;
  for (const e of existing) {
    const s = jaccard(t, e.tokens);
    if (s > bestScore) { bestScore = s; best = e; }
  }
  if (bestScore >= 0.6) return { verdict: 'likely-dup', match: best.name, score: +bestScore.toFixed(2), reason: 'title' };
  if (bestScore >= 0.35) return { verdict: 'review', match: best.name, score: +bestScore.toFixed(2), reason: 'title' };
  return { verdict: 'new', match: best ? best.name : null, score: +bestScore.toFixed(2), reason: 'title' };
}

// ─── protocols.io API ───────────────────────────────────
function loadToken() {
  const raw = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8'));
  const tok = raw.client_access_token;
  if (!tok) throw new Error(`No client_access_token in ${SECRET_FILE}`);
  return tok;
}

async function searchTerm(term, per, token) {
  const url = `${API_BASE}?filter=public&key=${encodeURIComponent(term)}` +
    `&order_field=views&order_dir=desc&page_size=${per}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`protocols.io ${res.status} for "${term}": ${await res.text().catch(() => '')}`);
  const body = await res.json();
  const items = body.items || body.protocols || [];
  return items.map(it => ({
    term,
    id: it.id,
    uri: it.uri,
    url: it.url || (it.uri ? `https://www.protocols.io/view/${it.uri}` : null),
    title: (it.title || it.name || '').trim(),
    views: (it.stats && it.stats.number_of_views) || it.number_of_views || 0,
    doi: it.doi || '',
    authors: (it.authors || []).map(a => a.name).filter(Boolean).slice(0, 3),
    published: it.published_on ? new Date(it.published_on * 1000).toISOString().slice(0, 10) : null,
  }));
}

// ─── Report ─────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function buildMarkdown(rows, meta) {
  const L = [];
  L.push(`# protocols.io candidate report — ${meta.date}`);
  L.push('');
  L.push(`Terms: ${meta.termCount} · raw hits: ${meta.raw} · unique: ${meta.unique} · ` +
    `**new: ${meta.counts.new}** · review: ${meta.counts.review} · likely-dup: ${meta.counts['likely-dup']}`);
  L.push('');
  L.push('Sorted by views. `new` = no close match in library. `review` = partial title overlap, check by hand. ' +
    '`likely-dup` = already covered (DOI or ≥0.6 title match).');
  L.push('');
  const order = { new: 0, review: 1, 'likely-dup': 2 };
  const sorted = [...rows].sort((a, b) =>
    (order[a.verdict] - order[b.verdict]) || (b.views - a.views));
  let cur = null;
  for (const r of sorted) {
    if (r.verdict !== cur) { cur = r.verdict; L.push(`\n## ${cur.toUpperCase()}\n`); }
    const dup = r.match ? ` _(closest: ${r.match} · ${r.score})_` : '';
    const doi = r.doi ? ` · doi:${r.doi}` : '';
    L.push(`- **${r.title}** — ${r.views.toLocaleString()} views · [${r.term}]${doi}${dup}`);
    if (r.url) L.push(`  <${r.url}>`);
  }
  L.push('');
  return L.join('\n');
}

// ─── Main ───────────────────────────────────────────────
async function main() {
  if (typeof fetch !== 'function') {
    console.error('This script needs Node 18+ (global fetch). Current: ' + process.version);
    process.exit(1);
  }
  const args = parseArgs(process.argv);
  const token = loadToken();
  const terms = args.adHocTerms.length
    ? args.adHocTerms
    : JSON.parse(fs.readFileSync(TERMS_FILE, 'utf8')).terms;

  console.error(`Loading existing library from ${RECIPES_DIR} …`);
  const existing = loadExisting();
  console.error(`  ${existing.length} recipes indexed for dedup.`);

  const seen = new Map(); // protocols.io id → row (dedup across terms)
  let raw = 0;
  for (const term of terms) {
    process.stderr.write(`Searching "${term}" … `);
    try {
      const hits = await searchTerm(term, args.per, token);
      raw += hits.length;
      let added = 0;
      for (const h of hits) {
        if (h.views < args.minViews) continue;
        if (!h.title) continue;
        if (seen.has(h.id)) continue;
        const c = classify(h.title, h.doi, existing);
        seen.set(h.id, { ...h, ...c });
        added++;
      }
      console.error(`${hits.length} hits (+${added} new to set)`);
    } catch (e) {
      console.error(`FAILED: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 350)); // be polite to the API
  }

  const rows = [...seen.values()];
  const counts = { new: 0, review: 0, 'likely-dup': 0 };
  for (const r of rows) counts[r.verdict]++;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const date = todayStr();
  const meta = { date, termCount: terms.length, raw, unique: rows.length, counts };
  const jsonPath = path.join(OUT_DIR, `candidates-${date}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ meta, candidates: rows }, null, 2) + '\n');
  console.error(`\nWrote ${jsonPath}`);

  if (!args.jsonOnly) {
    const mdPath = path.join(OUT_DIR, `candidates-${date}.md`);
    fs.writeFileSync(mdPath, buildMarkdown(rows, meta));
    console.error(`Wrote ${mdPath}`);
  }

  // Machine-readable summary line on stdout (for cron wrappers to grep/relay)
  console.log(JSON.stringify({ date, ...counts, unique: rows.length, report: jsonPath }));
}

main().catch(e => { console.error(e); process.exit(1); });
