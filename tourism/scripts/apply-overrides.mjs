#!/usr/bin/env node
/**
 * npm run tourism:apply-overrides
 *
 *   --dry-run   report what would change, write nothing
 *
 * Rewrites the manifest so every pinned slot in tourism/data/overrides.json
 * carries the photograph a human chose. Contacts nothing: an override can only
 * name a candidate already in tourism/manifest/candidates.json, so the full
 * provider response is on disk and there is nothing to fabricate.
 *
 * Exits non-zero if an override is unusable — a slug typo, or a photo that was
 * never a candidate — rather than silently leaving the ranker's pick in place
 * and letting you think your decision took effect.
 */

import { loadManifest, saveManifest } from '../lib/manifest.js';
import { loadCandidates } from '../lib/candidates.js';
import { loadOverrides, applyOverrides, findDuplicates } from '../lib/overrides.js';

function main() {
  const dryRun = process.argv.includes('--dry-run');

  let overrides;
  try {
    overrides = loadOverrides();
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const slots = Object.keys(overrides);
  if (!slots.length) {
    console.log('No overrides set. Nothing to do.');
    console.log('Pin a choice from the review sheet: npm run tourism:review');
    return;
  }

  const manifest = loadManifest();
  const store = loadCandidates();
  const { records, applied, problems } = applyOverrides(
    manifest.records,
    overrides,
    store,
  );

  console.log(`OVERRIDES — ${slots.length} pinned slot(s)\n`);
  for (const line of applied) console.log(`  ok    ${line}`);
  for (const line of problems) console.log(`  FAIL  ${line}`);

  // A human pinning by hand is the easiest way to use one photograph twice;
  // the ranker's uniqueness rule cannot see a decision made in a text file.
  const duplicates = findDuplicates(records);
  if (duplicates.length) {
    console.log('\nDuplicate photographs after overrides:');
    for (const dup of duplicates) {
      console.log(`  ${dup.photo} used in ${dup.slots.join(', ')}`);
    }
  }

  if (problems.length) {
    console.error(`\n${problems.length} override(s) could not be applied. Manifest unchanged.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log('\nDry run — manifest not written.');
    return;
  }

  saveManifest(records);
  console.log(`\nManifest updated. Next: npm run tourism:build-pages && npm run tourism:validate`);

  if (duplicates.length) {
    console.error('Resolve the duplicates above before publishing.');
    process.exit(1);
  }
}

main();
