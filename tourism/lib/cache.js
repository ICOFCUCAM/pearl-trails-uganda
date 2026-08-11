/**
 * Resolution cache.
 *
 * Keyed by country + category + query, so re-running the resolver after adding
 * one country does not re-spend the API budget on the other thirteen. `--force`
 * bypasses reads but still writes, and a cache entry older than MAX_AGE_DAYS is
 * treated as absent so photographs do not silently rot.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_PATH = resolve(HERE, '../cache/resolver-cache.json');

const MAX_AGE_DAYS = 90;

export function cacheKey(entry) {
  return `${entry.country}::${entry.category}::${entry.searchQuery}`;
}

export function loadCache(path = CACHE_PATH) {
  if (!existsSync(path)) return { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.entries) {
      return { version: 1, entries: {} };
    }
    return parsed;
  } catch {
    // A corrupt cache is not worth failing a build over — rebuild it.
    return { version: 1, entries: {} };
  }
}

export function saveCache(cache, path = CACHE_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

/**
 * @param {object} cache
 * @param {object} entry
 * @param {{force?: boolean, now?: number}} opts
 */
export function readCache(cache, entry, { force = false, now = Date.now() } = {}) {
  if (force) return null;
  const hit = cache.entries[cacheKey(entry)];
  if (!hit) return null;
  const ageDays = (now - new Date(hit.resolvedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays > MAX_AGE_DAYS) return null;
  return hit;
}

export function writeCache(cache, entry, record) {
  cache.entries[cacheKey(entry)] = record;
  return cache;
}

export const __test__ = { MAX_AGE_DAYS };
