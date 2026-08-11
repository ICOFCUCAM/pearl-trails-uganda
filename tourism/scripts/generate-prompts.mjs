#!/usr/bin/env node
/**
 * npm run tourism:prompts
 *
 *   --country <slug>   restrict to one destination (repeatable)
 *   --category <id>    restrict to one category (repeatable)
 *   --format <fmt>     text (default) | json | csv
 *   --stdout           print instead of writing files
 *
 * Writes one art-direction brief per slot:
 *
 *   tourism/prompts/tourism-prompts.json   structured, for tooling
 *   tourism/prompts/<country>.md           paste-ready, one file per destination
 *
 * These are instructions, not images. Run them through whichever generator you
 * use, drop the results into tourism/generated/, then `npm run tourism:review`
 * puts each reference beside the ranked Unsplash and Pexels candidates.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_DESTINATIONS, getDestination } from '../data/countries/index.js';
import { CATEGORY_IDS } from '../data/categories.js';
import { briefsFor, briefToText } from '../lib/prompt.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(ROOT, 'tourism/prompts');

function parseArgs(argv) {
  const opts = { countries: [], categories: [], format: 'text', stdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--country': opts.countries.push(String(argv[++i]).toLowerCase()); break;
      case '--category': opts.categories.push(String(argv[++i]).toLowerCase()); break;
      case '--format': opts.format = String(argv[++i]).toLowerCase(); break;
      case '--stdout': opts.stdout = true; break;
      case '--help': case '-h': opts.help = true; break;
      default:
        if (String(argv[i]).startsWith('--')) throw new Error(`Unknown flag ${argv[i]}`);
    }
  }
  return opts;
}

const HELP = `
East Africa tourism art-direction briefs

  npm run tourism:prompts -- [options]

  --country <slug>   uganda, kenya, ..., east-africa   (repeatable)
  --category <id>    hero, wildlife, safari, ...       (repeatable)
  --format <fmt>     text | json | csv                 (default: text)
  --stdout           print instead of writing files

Emits one generation brief per slot. It contacts nothing and generates
nothing — the output is the instruction set you feed to an image generator.
`;

function toCsv(briefs) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = [
    'slot', 'country', 'category', 'caption', 'aspect_ratio', 'min_width',
    'prompt', 'negative_prompt', 'composition',
  ];
  const rows = briefs.map((b) =>
    [
      b.referenceFor, b.countryName, b.categoryTitle, b.caption,
      b.aspectRatio, b.minimumWidth, b.prompt, b.negativePrompt, b.composition,
    ].map(cell).join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

function markdownFor(destination, briefs) {
  return [
    `# ${destination.name} — tourism image briefs`,
    '',
    `${destination.tagline}. ${briefs.length} slots.`,
    '',
    'Each brief below is a reference target: the photograph you are trying to find.',
    'Generate it, then compare it against the Unsplash and Pexels candidates in the',
    'review sheet and keep whichever genuinely fits.',
    '',
    '---',
    '',
    ...briefs.map(briefToText),
  ].join('\n');
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (!['text', 'json', 'csv'].includes(opts.format)) {
    console.error(`--format must be text, json or csv, got "${opts.format}"`);
    process.exit(2);
  }
  for (const id of opts.categories) {
    if (!CATEGORY_IDS.includes(id)) {
      console.error(`Unknown category "${id}". Known: ${CATEGORY_IDS.join(', ')}`);
      process.exit(2);
    }
  }

  let destinations;
  try {
    destinations = opts.countries.length
      ? opts.countries.map(getDestination)
      : ALL_DESTINATIONS;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const byDestination = destinations.map((destination) => ({
    destination,
    briefs: briefsFor(destination).filter(
      (b) => !opts.categories.length || opts.categories.includes(b.category),
    ),
  }));
  const all = byDestination.flatMap((d) => d.briefs);

  if (opts.stdout) {
    if (opts.format === 'json') console.log(JSON.stringify(all, null, 2));
    else if (opts.format === 'csv') console.log(toCsv(all));
    else for (const { destination, briefs } of byDestination) {
      console.log(markdownFor(destination, briefs));
    }
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const written = [];

  writeFileSync(
    resolve(OUT_DIR, 'tourism-prompts.json'),
    `${JSON.stringify({ version: 1, count: all.length, briefs: all }, null, 2)}\n`,
    'utf8',
  );
  written.push('tourism/prompts/tourism-prompts.json');

  if (opts.format === 'csv') {
    writeFileSync(resolve(OUT_DIR, 'tourism-prompts.csv'), `${toCsv(all)}\n`, 'utf8');
    written.push('tourism/prompts/tourism-prompts.csv');
  }

  for (const { destination, briefs } of byDestination) {
    if (!briefs.length) continue;
    writeFileSync(
      resolve(OUT_DIR, `${destination.slug}.md`),
      markdownFor(destination, briefs),
      'utf8',
    );
    written.push(`tourism/prompts/${destination.slug}.md`);
  }

  console.log(`Wrote ${all.length} briefs across ${byDestination.length} destinations:`);
  for (const path of written.slice(0, 6)) console.log(`  ${path}`);
  if (written.length > 6) console.log(`  … and ${written.length - 6} more`);
  console.log('\nNext: generate the references, drop them in tourism/generated/,');
  console.log('then run `npm run tourism:review` to compare against the stock candidates.');
}

main();
