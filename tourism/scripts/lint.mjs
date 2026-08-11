#!/usr/bin/env node
/**
 * npm run lint
 *
 * A project-specific linter rather than a generic style checker. It enforces
 * the rules this system actually depends on:
 *
 *   1. No fabricated image URLs or photo ids anywhere in source.
 *   2. No provider credential ever reaching browser-facing code.
 *   3. The fixed-window band invariant: no transform/filter/will-change on
 *      .ptu-still or its picture — the effect dies silently if that is broken.
 *   4. No tourism image rendered without alt handling.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const problems = [];

const flag = (file, message) => problems.push(`${relative(ROOT, file)}: ${message}`);

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'cache', 'manifest'].includes(name)) continue;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.includes(extname(name))) out.push(full);
  }
  return out;
}

/* ---- 1. fabricated URLs and ids ------------------------------------------ */

// A literal Unsplash/Pexels CDN path in source means somebody hand-wrote an
// image URL instead of using the API response. The provider modules and the
// CDN helper are allowed to reference the *host* for validation only.
// Tests carry mock payloads that necessarily contain provider-shaped URLs.
const hostAllowed = (rel) =>
  rel.startsWith('tourism/tests/') ||
  [
    'tourism/lib/cdn.js',
    'tourism/lib/providers/unsplash.js',
    'tourism/lib/providers/pexels.js',
    'tourism/scripts/typecheck.mjs',
    'tourism/scripts/lint.mjs',
  ].includes(rel);

for (const file of walk(resolve(ROOT, 'tourism'), ['.js', '.mjs'])) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');

  if (/images\.(unsplash|pexels)\.com\/[a-z]/i.test(source) && !hostAllowed(rel)) {
    flag(file, 'hard-coded provider CDN path — image URLs must come from the API response');
  }
  if (/\bphoto-\d{10,}/.test(source) && !hostAllowed(rel)) {
    flag(file, 'looks like a hand-written Unsplash photo id');
  }

  /* ---- 2. credentials ----
     Only the build-time modules may name a credential. Anything that renders
     markup must not, because that is the path to a key reaching the browser. */
  if (/UNSPLASH_ACCESS_KEY|PEXELS_API_KEY/.test(source)) {
    const serverSide =
      rel === 'tourism/lib/env.js' ||
      rel === 'tourism/lib/validate.js' ||
      rel.startsWith('tourism/lib/providers/') ||
      rel.startsWith('tourism/scripts/') ||
      rel.startsWith('tourism/tests/');
    if (!serverSide) {
      flag(file, 'references a provider key outside the server-side scripts');
    }
  }
  if (/Client-ID\s*\$\{/.test(source) && !rel.includes('providers/unsplash.js')) {
    flag(file, 'builds an Unsplash auth header outside the provider module');
  }
}

/* ---- 3. fixed-window invariant ------------------------------------------- */

// `text-transform` is harmless, so the boundary excludes a preceding hyphen.
const BANNED_IN_BAND =
  /(?<![-\w])(transform|filter|backdrop-filter|perspective|will-change|contain)\s*:/;

// Only the band itself and the chain down to the fixed picture matter — a
// descendant of .ptu-still-copy is not an ancestor of the fixed element.
const BAND_CHAIN = /^\.ptu-(still(--[a-z]+)?|still-pic|t-band|t-hero-pic)$/;

for (const file of walk(ROOT, ['.css'])) {
  const source = readFileSync(file, 'utf8');
  const blocks = source.match(/[^{}]+\{[^}]*\}/g) ?? [];
  for (const block of blocks) {
    const selector = block.slice(0, block.indexOf('{')).trim();
    const onChain = selector
      .split(',')
      .some((part) => part.trim().split(/\s+/).every((s) => BAND_CHAIN.test(s)));
    if (!onChain) continue;
    if (BANNED_IN_BAND.test(block.slice(block.indexOf('{')))) {
      flag(file, `fixed-window band rule creates a containing block: ${selector}`);
    }
  }
}

/* ---- 4. images always carry alt ------------------------------------------ */

for (const file of walk(ROOT, ['.html'])) {
  const source = readFileSync(file, 'utf8');
  for (const img of source.match(/<img\b[^>]*>/g) ?? []) {
    if (!/\balt=/.test(img)) flag(file, `<img> without alt: ${img.slice(0, 80)}`);
    if (/\bdata-tourism=/.test(img) && !/\bloading=/.test(img) && !/\bdata-tourism-eager\b/.test(img)) {
      flag(file, `tourism <img> without loading attribute: ${img.slice(0, 80)}`);
    }
  }
}

if (problems.length) {
  console.error(`lint failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('lint ok — no fabricated URLs, no leaked keys, band invariant intact.');
