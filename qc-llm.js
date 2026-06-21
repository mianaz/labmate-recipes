#!/usr/bin/env node
/**
 * labmate-recipes QC: LLM semantic reviewer
 *
 * Spawns a sub-agent to perform semantic review of a recipe:
 *   - Reference realism (does the DOI/ref actually exist and match?)
 *   - Scientific accuracy (are temperatures, times, concentrations reasonable?)
 *   - Bilingual quality (is the Chinese translation accurate and idiomatic?)
 *   - Completeness (missing safety warnings, obvious steps, etc.)
 *
 * This is intentionally split from qc.js because:
 *   - LLM review is slow (network calls, dozens of seconds per recipe)
 *   - Mechanical checks should run on every commit (fast, deterministic)
 *   - LLM review is best for: new recipes before first publish, periodic audits
 *
 * Usage:
 *   node qc-llm.js <recipe-id>      Review a single recipe
 *   node qc-llm.js --all            Review all recipes (slow!)
 *   node qc-llm.js --changed        Review recipes changed since last commit
 *   node qc-llm.js --staged         Review staged-but-uncommitted recipes
 *
 * Requires: openclaw CLI in PATH (for sessions_spawn)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_PATH = process.env.LABMATE_REPO || __dirname;
const RECIPES_DIR = path.join(REPO_PATH, 'recipes');

const CAT_DIRS = {
  buffer: 'buffers',
  protocol: 'protocols',
  media: 'media',
  staining: 'staining',
};

const QC_GUIDELINES = path.join(REPO_PATH, 'QC_GUIDELINES.md');

function findRecipe(query) {
  for (const dir of Object.values(CAT_DIRS)) {
    const fp = path.join(RECIPES_DIR, dir, `${query}.json`);
    if (fs.existsSync(fp)) return fp;
    const fp2 = path.join(RECIPES_DIR, dir, query);
    if (fs.existsSync(fp2)) return fp2;
  }
  if (fs.existsSync(query)) return query;
  return null;
}

function listAllRecipes() {
  const out = [];
  for (const [cat, dir] of Object.entries(CAT_DIRS)) {
    const dirPath = path.join(RECIPES_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.json'))) {
      out.push({ path: path.join(dirPath, f), rel: path.relative(REPO_PATH, dirPath) + '/' + f, id: f.replace('.json', '') });
    }
  }
  return out;
}

function listChangedRecipes(scope) {
  // scope: 'staged' | 'working' | 'last-commit'
  let cmd;
  if (scope === 'staged') cmd = 'git diff --cached --name-only --diff-filter=AM';
  else if (scope === 'last-commit') cmd = 'git diff HEAD~1 HEAD --name-only --diff-filter=AM';
  else cmd = 'git diff HEAD --name-only --diff-filter=AM';

  let stdout;
  try {
    stdout = execSync(cmd, { cwd: REPO_PATH, encoding: 'utf8' });
  } catch (e) {
    return [];
  }
  return stdout.split('\n')
    .filter(f => f.match(/^recipes\/(buffers|protocols|media|staining)\/.+\.json$/))
    .map(f => ({ path: path.join(REPO_PATH, f), rel: f, id: path.basename(f, '.json') }));
}

function buildReviewPrompt(recipePath) {
  const rel = path.relative(REPO_PATH, recipePath);
  const content = fs.readFileSync(recipePath, 'utf8');
  const guidelines = fs.existsSync(QC_GUIDELINES)
    ? fs.readFileSync(QC_GUIDELINES, 'utf8')
    : '(QC_GUIDELINES.md not found — fall back to standard scientific review)';

  return `You are the LabMate Recipe QC reviewer. Review the recipe at \`${rel}\` against the QC guidelines below.

# QC Guidelines

${guidelines}

# Recipe Under Review

File: \`${rel}\`

\`\`\`json
${content}
\`\`\`

# Your Task

1. **Verify references** — for each DOI/ref, confirm it's real and matches the content. Use web_search or web_fetch to check. If you find a fabricated or wrong reference, this is a HARD FAIL.
2. **Scientific sanity check** — do the times, temperatures, concentrations, and procedures look correct for the technique? Flag anything suspicious (e.g., "37°C overnight with trypsin" would be wrong).
3. **Bilingual quality** — does the Chinese translation make sense? Are technical terms consistent with how the rest of the library renders them?
4. **Completeness** — are there missing warnings, omitted critical steps, or unclear instructions that would trip up a user?
5. **Cross-link integrity** — do any \`linkedRecipe\` / \`relatedProtocols\` / \`crosslinks\` IDs reference recipes that don't exist in \`recipes/\`?

# Output Format

Return your review as a JSON object:

\`\`\`json
{
  "recipe_id": "<id>",
  "recipe_path": "${rel}",
  "verdict": "PASS" | "PASS_WITH_NOTES" | "FAIL",
  "issues": [
    {
      "severity": "BLOCKER" | "MAJOR" | "MINOR",
      "category": "reference" | "scientific" | "bilingual" | "completeness" | "crosslink",
      "msg": "<one-line description>",
      "fix": "<concrete suggestion or replacement text>"
    }
  ],
  "notes": ["<positive observations>"]
}
\`\`\`

Be specific and actionable. Don't approve recipes with fabricated references, even if everything else is fine. Don't be overly pedantic about style — focus on correctness and safety.`;
}

function spawnReviewer(recipePath) {
  // Use the openclaw CLI to spawn a sub-agent. This is intentionally a thin shell —
  // the heavy lifting happens in the sub-agent's context window, which we keep
  // out of the main session.
  const prompt = buildReviewPrompt(recipePath);
  const taskName = 'qc-review-' + path.basename(recipePath, '.json');

  console.log(`\n🤖 Spawning sub-agent reviewer for ${path.relative(REPO_PATH, recipePath)}...`);

  try {
    const result = execSync(
      `openclaw sessions spawn --task ${JSON.stringify(prompt)} --task-name ${JSON.stringify(taskName)} --runtime subagent --model sonnet4.6`,
      { stdio: 'inherit', cwd: REPO_PATH }
    );
    return result;
  } catch (e) {
    console.error(`  ❌ Sub-agent failed: ${e.message}`);
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`labmate-recipes LLM QC

Usage:
  node qc-llm.js <recipe-id>      Review a single recipe
  node qc-llm.js --all            Review all recipes
  node qc-llm.js --changed        Review uncommitted changes
  node qc-llm.js --staged         Review staged changes
  node qc-llm.js --last-commit    Review the last commit's changes
`);
    process.exit(0);
  }

  let targets = [];
  if (args.includes('--all')) {
    targets = listAllRecipes();
  } else if (args.includes('--changed')) {
    targets = listChangedRecipes('working');
  } else if (args.includes('--staged')) {
    targets = listChangedRecipes('staged');
  } else if (args.includes('--last-commit')) {
    targets = listChangedRecipes('last-commit');
  } else {
    const q = args.find(a => !a.startsWith('--'));
    if (!q) {
      console.error('❌ Provide a recipe id or use --all / --changed / --staged / --last-commit');
      process.exit(2);
    }
    const fp = findRecipe(q);
    if (!fp) {
      console.error(`❌ Recipe not found: ${q}`);
      process.exit(2);
    }
    targets = [{ path: fp, rel: path.relative(REPO_PATH, fp), id: q }];
  }

  if (targets.length === 0) {
    console.log('No recipes to review.');
    process.exit(0);
  }

  console.log(`\n📋 Will review ${targets.length} recipe(s):`);
  for (const t of targets) console.log(`  • ${t.rel}`);
  console.log('');

  const startTime = Date.now();
  let ok = 0, fail = 0;
  for (const t of targets) {
    const result = spawnReviewer(t.path);
    if (result !== null) ok++;
    else fail++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done. ${ok} reviewed, ${fail} failed in ${elapsed}s`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
