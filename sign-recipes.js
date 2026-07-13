#!/usr/bin/env node
// Signs dist/recipes.json into dist/manifest.json with an ed25519 detached
// signature, so the LabMate app can verify the recipe library it fetches from
// this repo before feeding it to the in-app agent. The signed message binds a
// domain tag + monotonic version + timestamp + SHA-256 of the raw recipe bytes,
// so neither the payload nor the manifest fields can be tampered with.
//
// Private key (PKCS8 PEM) comes from env RECIPE_SIGNING_KEY (a GitHub Actions
// secret). It must NEVER be committed. The matching public key is pinned in the
// app bundle (src/lib/recipeSigningKey.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, createPrivateKey, sign } from 'node:crypto';

const pem = process.env.RECIPE_SIGNING_KEY;
if (!pem) { console.error('RECIPE_SIGNING_KEY env not set'); process.exit(1); }

const recipes = readFileSync('dist/recipes.json'); // raw bytes — hash these exactly
const sha256 = createHash('sha256').update(recipes).digest('hex');
const version = Date.now();               // monotonic; app enforces a version floor
const generatedAt = new Date().toISOString();
const message = `labmate-recipes.v1\n${version}\n${generatedAt}\n${sha256}`;
const sig = sign(null, Buffer.from(message, 'utf8'), createPrivateKey(pem)).toString('base64');

const manifest = { alg: 'ed25519', version, generatedAt, sha256, sig };
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`signed recipes.json (${recipes.length} B) -> manifest v${version} sha256=${sha256.slice(0, 16)}...`);
