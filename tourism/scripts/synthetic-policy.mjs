#!/usr/bin/env node
/**
 * npm run tourism:synthetic-policy
 *
 *   --country <slug>   explain one destination's slots (repeatable)
 *   --all              show the refusal reason for every slot, not just the
 *                      slots that qualify
 *
 * Answers one question: which of the 405 slots may ever carry a synthetic
 * image, and for every slot that may not, why not.
 *
 * It reads the policy rather than restating it, so this output cannot drift
 * from what the resolver and the audit actually enforce.
 */

import { ALL_DESTINATIONS, getDestination } from '../data/countries/index.js';
import { CATEGORY_IDS } from '../data/categories.js';
import {
  SYNTHETIC_ALLOWED_CATEGORIES,
  REAL_ONLY_CATEGORIES,
  PROVIDER_PREFERENCE,
  VISUAL_DISCLOSURE,
  syntheticEligibility,
  policyConflicts,
} from '../data/synthetic-policy.js';

function main() {
  const args = process.argv.slice(2);
  const countries = [];
  let all = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--country') countries.push(String(args[++i]).toLowerCase());
    else if (args[i] === '--all') all = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('npm run tourism:synthetic-policy -- [--country <slug>] [--all]');
      return;
    }
  }

  let destinations;
  try {
    destinations = countries.length ? countries.map(getDestination) : ALL_DESTINATIONS;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  console.log('AFRINKONG AUTHENTICITY POLICY');
  console.log('  Real photography for real places and people.');
  console.log('  Synthetic imagery only for clearly illustrative visuals.\n');

  console.log(`  provider order   ${PROVIDER_PREFERENCE.join(' -> ')}`);
  console.log(`  disclosure       "${VISUAL_DISCLOSURE}"`);
  console.log(`  synthetic ok     ${SYNTHETIC_ALLOWED_CATEGORIES.join(', ')}`);
  console.log(`  real only        ${REAL_ONLY_CATEGORIES.length} of ${CATEGORY_IDS.length} categories\n`);

  const { conflicts, unknown, uncovered } = policyConflicts();
  if (conflicts.length || unknown.length || uncovered.length) {
    console.error('POLICY IS INCONSISTENT — fix before relying on it');
    if (conflicts.length) console.error(`  both allowed and protected: ${conflicts.join(', ')}`);
    if (unknown.length) console.error(`  not a real category: ${unknown.join(', ')}`);
    if (uncovered.length) console.error(`  in neither list: ${uncovered.join(', ')}`);
    process.exit(1);
  }

  let eligible = 0;
  let total = 0;

  for (const destination of destinations) {
    const lines = [];
    for (const entry of destination.categories) {
      total += 1;
      const { allowed, reasons } = syntheticEligibility(entry, destination);
      if (allowed) {
        eligible += 1;
        lines.push(`  ELIGIBLE  ${entry.category.padEnd(13)} ${entry.caption}`);
      } else if (all) {
        lines.push(`  real-only ${entry.category.padEnd(13)} ${reasons[0]}`);
      }
    }
    if (lines.length) {
      console.log(destination.name.toUpperCase());
      for (const line of lines) console.log(line);
      console.log('');
    }
  }

  console.log(`${eligible} of ${total} slot(s) may ever carry a synthetic image.`);
  console.log('Every other slot is real photography or honestly unresolved.');
  if (!all) console.log('\nRe-run with --all to see the refusal reason for every slot.');
}

main();
