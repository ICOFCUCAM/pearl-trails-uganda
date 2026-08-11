/**
 * The candidate shortlist store.
 *
 * The resolver ranks every result it gets and then picks one. That decision is
 * invisible unless the runners-up are kept, so this file holds the top five
 * per slot with their score breakdowns. It is review data, deliberately kept
 * out of the manifest: the manifest is what the site renders and should stay
 * small, this is what you read when a pick looks wrong.
 *
 * It is also what `overrides` resolves against — pinning a different
 * photograph never needs another API call, because the alternatives are
 * already here, complete, exactly as the provider returned them.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CANDIDATES_PATH = resolve(HERE, '../manifest/candidates.json');

export function loadCandidates(path = CANDIDATES_PATH) {
  if (!existsSync(path)) return { version: 1, generatedAt: null, slots: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed.slots !== 'object') {
      return { version: 1, generatedAt: null, slots: {} };
    }
    return parsed;
  } catch {
    return { version: 1, generatedAt: null, slots: {} };
  }
}

/** Merge a run's shortlists into whatever is already stored. */
export function saveCandidates(slots, path = CANDIDATES_PATH) {
  const existing = loadCandidates(path);
  const merged = { ...existing.slots, ...slots };
  mkdirSync(dirname(path), { recursive: true });
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    slots: Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

/** Every candidate recorded for a slot, best first. */
export function shortlistFor(store, country, category) {
  return store.slots[`${country}::${category}`]?.shortlist ?? [];
}

/** Find one specific candidate anywhere in the store. */
export function findCandidate(store, country, category, provider, photoId) {
  return (
    shortlistFor(store, country, category).find(
      (c) => c.provider === provider && String(c.photoId) === String(photoId),
    ) ?? null
  );
}
