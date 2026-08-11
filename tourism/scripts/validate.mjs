#!/usr/bin/env node
/**
 * npm run tourism:validate
 *
 *   --country <slug>   report on one destination only (repeatable)
 *   --category <id>    report on one category only    (repeatable)
 *   --json             machine-readable output
 *   --strict           exit non-zero on warnings too (unresolved counts as a
 *                      warning by default, because an honest gap is not a bug)
 *
 * Exits 1 when there are errors: a broken URL, a duplicate photograph, a
 * missing caption or alt text, an invalid provider record, or a leaked key.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRIES, REGION } from '../data/countries/index.js';
import { loadManifest } from '../lib/manifest.js';
import { auditManifest, auditBuiltPages, summarise } from '../lib/validate.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const PAGES = [
  'index.html',
  'services.html',
  'about.html',
  'contact.html',
  'pricing.html',
  'east-africa.html',
  ...COUNTRIES.map((c) => `destinations/${c.slug}.html`),
];

function parseArgs(argv) {
  const opts = { countries: [], categories: [], json: false, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--country': opts.countries.push(String(argv[++i]).toLowerCase()); break;
      case '--category': opts.categories.push(String(argv[++i]).toLowerCase()); break;
      case '--json': opts.json = true; break;
      case '--strict': opts.strict = true; break;
      default: break;
    }
  }
  return opts;
}

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();

  let records = manifest.records;
  if (opts.countries.length) {
    records = records.filter((r) => opts.countries.includes(r.country));
  }
  if (opts.categories.length) {
    records = records.filter((r) => opts.categories.includes(r.category));
  }

  const audit = auditManifest({ ...manifest, records });
  const pageIssues = opts.countries.length || opts.categories.length
    ? []
    : auditBuiltPages(ROOT, PAGES);
  const allIssues = [...audit.issues, ...pageIssues];
  const totals = summarise(allIssues);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: manifest.generatedAt,
          countries: Object.fromEntries(audit.byCountry),
          issues: allIssues,
          totals,
        },
        null,
        2,
      ),
    );
    process.exit(totals.errors > 0 || (opts.strict && totals.warnings > 0) ? 1 : 0);
  }

  console.log('EAST AFRICA TOURISM IMAGE AUDIT');
  console.log(
    `generated ${manifest.generatedAt ?? 'never — resolver has not run'}\n`,
  );

  const rows = [...audit.byCountry.entries()].filter(
    ([slug]) => !opts.countries.length || opts.countries.includes(slug),
  );

  let totalResolved = 0;
  let totalUnsplash = 0;
  let totalPexels = 0;
  let totalUnresolved = 0;
  let totalDuplicates = 0;

  for (const [slug, stat] of rows) {
    const label = stat.isRegion ? `${stat.name} (region)` : stat.name;
    console.log(label.toUpperCase());
    console.log(`  ${num(stat.present, 2)}/${stat.total} categories`);
    console.log(`  ${num(stat.unsplash, 2)} Unsplash`);
    console.log(`  ${num(stat.pexels, 2)} Pexels`);
    console.log(`  ${num(stat.unresolved, 2)} unresolved`);
    console.log(`  ${num(stat.duplicates, 2)} duplicates`);
    console.log('');
    totalResolved += stat.resolved;
    totalUnsplash += stat.unsplash;
    totalPexels += stat.pexels;
    totalUnresolved += stat.unresolved;
    totalDuplicates += stat.duplicates;
    void slug;
  }

  console.log('TOTAL');
  console.log(`  ${num(records.length, 3)} image records`);
  console.log(`  ${num(totalResolved, 3)} resolved`);
  console.log(`  ${num(totalUnsplash, 3)} Unsplash`);
  console.log(`  ${num(totalPexels, 3)} Pexels`);
  console.log(`  ${num(totalUnresolved, 3)} unresolved`);
  console.log(`  ${num(totalDuplicates, 3)} duplicate uses`);

  const kinds = [
    ['broken-url', 'Broken / non-provider URLs'],
    ['missing-image', 'Missing images'],
    ['duplicate', 'Duplicate images'],
    ['missing-caption', 'Missing captions'],
    ['generic-caption', 'Generic captions'],
    ['missing-alt', 'Missing alt text'],
    ['weak-alt', 'Weak alt text'],
    ['missing-description', 'Missing descriptions'],
    ['bad-aspect', 'Bad aspect ratios'],
    ['bad-focal-point', 'Bad focal points'],
    ['invalid-provider', 'Invalid provider records'],
    ['missing-attribution', 'Missing attribution'],
    ['unresolved', 'Unresolved slots'],
    ['leaked-key', 'Leaked API keys'],
    ['placeholder-remaining', 'Pages still on SVG placeholders'],
    ['missing-page', 'Pages not generated'],
  ];

  console.log('\nCHECKS');
  for (const [kind, label] of kinds) {
    const count = totals.counts[kind] ?? 0;
    console.log(`  ${pad(label, 34)} ${num(count, 4)}${count ? '' : '  ok'}`);
  }

  const shown = allIssues.filter((i) => i.level === 'error').slice(0, 25);
  if (shown.length) {
    console.log('\nERRORS');
    for (const issue of shown) {
      console.log(`  [${issue.kind}] ${issue.where}: ${issue.message}`);
    }
    const hidden = totals.errors - shown.length;
    if (hidden > 0) console.log(`  … and ${hidden} more`);
  }

  console.log(
    `\n${totals.errors} error(s), ${totals.warnings} warning(s).` +
      (totalUnresolved
        ? `\n${totalUnresolved} slot(s) have no photograph. That is reported, never faked —` +
          '\nrun `npm run tourism:resolve-images` with provider keys to fill them.'
        : ''),
  );

  void REGION;
  process.exit(totals.errors > 0 || (opts.strict && totals.warnings > 0) ? 1 : 0);
}

main();
