#!/usr/bin/env node
/**
 * npm run typecheck
 *
 * The site has no bundler and no TypeScript, so "typecheck" here means the two
 * things a type system would have caught: every module parses and loads, and
 * every data structure has the shape the rest of the system assumes.
 */

import { readdirSync, statSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const TOURISM = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'cache') continue;
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (['.js', '.mjs'].includes(extname(name))) out.push(full);
  }
  return out;
}

const failures = [];

/* 1. every module parses */
const files = walk(TOURISM);
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failures.push(`parse: ${file}\n${error.stderr?.toString() ?? error.message}`);
  }
}

/* 2. every module loads (catches bad imports and data-time throws) */
const { CATEGORIES, CATEGORY_IDS, ROLES, roleOf } = await import('../data/categories.js');
const { ALL_DESTINATIONS, COUNTRIES, REGION } = await import('../data/countries/index.js');
const { emptyManifest, indexManifest } = await import('../lib/manifest.js');
const { responsiveSet } = await import('../lib/cdn.js');

/* 3. shapes */
if (CATEGORIES.length !== 27) {
  failures.push(`expected 27 categories, found ${CATEGORIES.length}`);
}
if (new Set(CATEGORY_IDS).size !== CATEGORY_IDS.length) {
  failures.push('duplicate category ids');
}
for (const category of CATEGORIES) {
  for (const field of ['no', 'id', 'title', 'role', 'frame', 'intent']) {
    if (!category[field]) failures.push(`category ${category.id}: missing ${field}`);
  }
  if (!ROLES[category.role]) {
    failures.push(`category ${category.id}: unknown role "${category.role}"`);
  }
  if (typeof category.frame !== 'function') {
    failures.push(`category ${category.id}: frame is not a function`);
  }
}

for (const role of Object.values(ROLES)) {
  if (!Array.isArray(role.widths) || !role.widths.length) {
    failures.push(`role ${role.id}: no widths`);
  }
  if (!(role.aspect > 0)) failures.push(`role ${role.id}: bad aspect`);
}

if (COUNTRIES.length !== 14) {
  failures.push(`expected 14 countries, found ${COUNTRIES.length}`);
}
if (!REGION.isRegion) failures.push('REGION is not flagged isRegion');

for (const destination of ALL_DESTINATIONS) {
  for (const field of ['slug', 'name', 'tagline', 'eyebrow', 'lede', 'summary', 'signature']) {
    if (!destination[field]) failures.push(`${destination.slug}: missing ${field}`);
  }
  if (destination.categories.length !== 27) {
    failures.push(`${destination.slug}: ${destination.categories.length} categories, expected 27`);
  }
  for (const entry of destination.categories) {
    for (const field of ['caption', 'subject', 'description', 'alt', 'searchQuery']) {
      if (!entry[field]) failures.push(`${destination.slug}/${entry.category}: missing ${field}`);
    }
    const fp = entry.focalPoint;
    if (!fp || !(fp.x >= 0 && fp.x <= 100) || !(fp.y >= 0 && fp.y <= 100)) {
      failures.push(`${destination.slug}/${entry.category}: bad focalPoint`);
    }
    if (!roleOf({ role: entry.role, id: entry.category })) {
      failures.push(`${destination.slug}/${entry.category}: unresolvable role`);
    }
  }
}

/* 4. the manifest contract holds even with nothing resolved */
const index = indexManifest(emptyManifest());
if (index.records.length !== ALL_DESTINATIONS.length * 27) {
  failures.push(
    `empty manifest has ${index.records.length} records, expected ${ALL_DESTINATIONS.length * 27}`,
  );
}
index.get('uganda', 'hero');

/* 5. the CDN helper produces valid URLs for a synthetic record */
const url = responsiveSet(
  {
    provider: 'unsplash',
    baseUrl: 'https://images.unsplash.com/photo-example',
    width: 4000,
    height: 2600,
  },
  'hero',
);
if (!url.srcset.includes('w=')) failures.push('responsiveSet produced no width parameters');

if (failures.length) {
  console.error(`typecheck failed with ${failures.length} problem(s):\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `typecheck ok — ${files.length} modules parsed, ` +
    `${ALL_DESTINATIONS.length} destinations x 27 categories verified.`,
);
