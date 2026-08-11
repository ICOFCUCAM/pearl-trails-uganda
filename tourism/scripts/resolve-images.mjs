#!/usr/bin/env node
/**
 * npm run tourism:resolve-images
 *
 *   --country <slug>     restrict to one destination (repeatable)
 *   --category <id>      restrict to one category (repeatable)
 *   --provider <name>    force a single provider: unsplash | pexels
 *   --force              ignore the cache and re-resolve
 *   --dry-run            report what would be requested, contact nothing
 *
 * Unsplash is tried first for every slot; Pexels only runs when Unsplash
 * returned nothing that cleared the ranking threshold. When neither has a
 * suitable photograph the slot is recorded as unresolved with the reason — no
 * URL is ever invented to fill it.
 */

import { COUNTRIES, ALL_DESTINATIONS, getDestination } from '../data/countries/index.js';
import { CATEGORY_IDS } from '../data/categories.js';
import { getCredentials, describeCredentials } from '../lib/env.js';
import { loadCache, saveCache } from '../lib/cache.js';
import { resolveAll, STATUS, cacheKey } from '../lib/resolver.js';
import { loadManifest, saveManifest } from '../lib/manifest.js';

function parseArgs(argv) {
  const opts = {
    countries: [],
    categories: [],
    provider: null,
    force: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case '--country':
        opts.countries.push(String(next()).toLowerCase());
        break;
      case '--category':
        opts.categories.push(String(next()).toLowerCase());
        break;
      case '--provider':
        opts.provider = String(next()).toLowerCase();
        break;
      case '--force':
        opts.force = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag ${arg}`);
        }
    }
  }
  return opts;
}

const HELP = `
East Africa tourism image resolver

  npm run tourism:resolve-images -- [options]

  --country <slug>   uganda, kenya, ..., east-africa   (repeatable)
  --category <id>    hero, wildlife, safari, ...       (repeatable)
  --provider <name>  unsplash | pexels                 (forces one provider)
  --force            ignore cached resolutions
  --dry-run          print the plan, contact no provider

Credentials are read from UNSPLASH_ACCESS_KEY and PEXELS_API_KEY in the
environment or in a local .env file. They are never written to any page.
`;

async function main() {
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

  if (opts.provider && !['unsplash', 'pexels'].includes(opts.provider)) {
    console.error(`--provider must be unsplash or pexels, got "${opts.provider}"`);
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

  const credentials = getCredentials();
  const described = describeCredentials();

  console.log('EAST AFRICA TOURISM IMAGE RESOLVER');
  console.log(`  destinations   ${destinations.length} (${COUNTRIES.length} countries + region)`);
  console.log(
    `  categories     ${opts.categories.length || CATEGORY_IDS.length}` +
      (opts.categories.length ? ` (${opts.categories.join(', ')})` : ' (all 27)'),
  );
  console.log(`  unsplash key   ${described.unsplash}`);
  console.log(`  pexels key     ${described.pexels}`);
  console.log(`  provider       ${opts.provider ?? 'unsplash, then pexels'}`);
  console.log(`  cache          ${opts.force ? 'bypassed (--force)' : 'enabled'}`);

  const slots =
    destinations.length * (opts.categories.length || CATEGORY_IDS.length);

  if (opts.dryRun) {
    console.log(`\nDry run — ${slots} slots would be resolved. Nothing contacted.`);
    return;
  }

  if (!credentials.unsplash && !credentials.pexels) {
    console.error(
      '\nNo provider credentials found. Set UNSPLASH_ACCESS_KEY (primary) and/or\n' +
        'PEXELS_API_KEY (fallback) in the environment or a .env file, then re-run.\n' +
        'Nothing was written: fabricating image URLs is never an option.',
    );
    process.exit(1);
  }

  // Seed the cache from the committed manifest. The cache file is local and
  // gitignored, so on a fresh checkout (CI, or a new clone) it is empty — and
  // without this every already-resolved slot would be paid for again, which
  // overruns the provider rate limit on a full run. Unresolved records are
  // deliberately not seeded, so each run retries the gaps.
  const cache = loadCache();
  let seeded = 0;
  for (const record of loadManifest().records) {
    if (record.status !== STATUS.RESOLVED || !record.searchQuery) continue;
    const key = cacheKey(record);
    if (cache.entries[key]) continue;
    cache.entries[key] = record;
    seeded += 1;
  }
  if (seeded) console.log(`  seeded         ${seeded} resolved slots from the manifest`);

  const { records, stats } = await resolveAll(destinations, {
    cache,
    force: opts.force,
    categories: opts.categories.length ? opts.categories : null,
    credentials,
    only: opts.provider,
    log: (line) => console.log(line),
  });
  saveCache(cache);

  // Merge into the existing manifest so a partial run (--country kenya) does
  // not discard everything else.
  const existing = loadManifest();
  const merged = new Map(
    existing.records.map((r) => [`${r.country}::${r.category}`, r]),
  );
  for (const record of records) {
    merged.set(`${record.country}::${record.category}`, record);
  }
  saveManifest([...merged.values()]);

  const unsplashCount = records.filter((r) => r.provider === 'unsplash').length;
  const pexelsCount = records.filter((r) => r.provider === 'pexels').length;
  const unresolved = records.filter((r) => r.status === STATUS.UNRESOLVED).length;

  console.log('\nDone.');
  console.log(`  from cache     ${stats.fromCache}`);
  console.log(`  unsplash       ${unsplashCount}`);
  console.log(`  pexels         ${pexelsCount}`);
  console.log(`  unresolved     ${unresolved}`);
  console.log('\nNext: npm run tourism:build-pages && npm run tourism:validate');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
