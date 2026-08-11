/**
 * The manifest: the single source of truth for what the pages render.
 *
 * The build reads this file, never the providers. That keeps page generation
 * deterministic and offline, and means a deploy cannot be broken by a provider
 * outage. When no manifest exists yet, `loadManifest` synthesises a fully
 * unresolved one from the country data so the site still builds — with honest
 * unresolved plates rather than invented photographs.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_DESTINATIONS } from '../data/countries/index.js';
import { toUnresolved, STATUS } from './resolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MANIFEST_PATH = resolve(HERE, '../manifest/tourism-images.json');

export function emptyManifest() {
  const records = [];
  for (const destination of ALL_DESTINATIONS) {
    for (const entry of destination.categories) {
      records.push(
        toUnresolved(
          entry,
          'not yet resolved — run `npm run tourism:resolve-images` with provider keys',
          { resolvedAt: null },
        ),
      );
    }
  }
  return { version: 1, generatedAt: null, records };
}

export function loadManifest(path = MANIFEST_PATH) {
  if (!existsSync(path)) return emptyManifest();
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || !Array.isArray(parsed.records)) return emptyManifest();

  // Merge: authored copy always wins over whatever the manifest froze, so an
  // edited caption reaches the page without re-hitting the API.
  const byKey = new Map(parsed.records.map((r) => [`${r.country}::${r.category}`, r]));
  const merged = [];
  for (const destination of ALL_DESTINATIONS) {
    for (const entry of destination.categories) {
      const stored = byKey.get(`${entry.country}::${entry.category}`);
      if (!stored) {
        merged.push(toUnresolved(entry, 'no manifest record', { resolvedAt: null }));
        continue;
      }
      merged.push({
        ...stored,
        caption: entry.caption,
        description: entry.description,
        alt: entry.alt,
        searchQuery: entry.searchQuery,
        focalPoint: stored.focalPoint ?? entry.focalPoint,
        categoryTitle: entry.categoryTitle,
        countryName: entry.countryName,
        no: entry.no,
      });
    }
  }
  return { ...parsed, records: merged };
}

export function saveManifest(records, path = MANIFEST_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    records: [...records].sort(
      (a, b) => a.country.localeCompare(b.country) || a.no.localeCompare(b.no),
    ),
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

/** Index a manifest for lookup: manifest.get('uganda', 'wildlife'). */
export function indexManifest(manifest) {
  const map = new Map(
    manifest.records.map((r) => [`${r.country}::${r.category}`, r]),
  );
  return {
    records: manifest.records,
    generatedAt: manifest.generatedAt,
    get(country, category) {
      const found = map.get(`${country}::${category}`);
      if (!found) {
        throw new Error(`No manifest record for ${country}/${category}`);
      }
      return found;
    },
    forCountry(country) {
      return manifest.records.filter((r) => r.country === country);
    },
    isResolved(country, category) {
      return this.get(country, category).status === STATUS.RESOLVED;
    },
  };
}
