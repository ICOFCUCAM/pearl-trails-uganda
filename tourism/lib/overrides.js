/**
 * Manual overrides — the human verdict on top of the ranker.
 *
 * The ranker is good at "is this the right country and the right subject". It
 * cannot judge whether a photograph is actually the one you want. So after a
 * review pass you pin the choice here, and it wins.
 *
 * An override names a photograph that is ALREADY in the candidate store, which
 * means applying it costs no API call and cannot fabricate anything: the full
 * provider response for that photo is on disk. An override naming a photograph
 * that is not in the store is an error, not a silent no-op.
 *
 * tourism/data/overrides.json:
 *
 *   {
 *     "uganda/wildlife": { "provider": "unsplash", "photoId": "abc123",
 *                          "why": "the ranker's pick was a lowland gorilla" },
 *     "uganda/beaches":  { "status": "unresolved",
 *                          "why": "nothing on either provider is Lake Victoria" }
 *   }
 *
 * The second form is the other half of the point: it lets a reviewer say "none
 * of these are good enough", and the slot stays honestly empty rather than
 * carrying a photograph nobody was happy with.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findCandidate } from './candidates.js';
import { toRecord, toUnresolved, STATUS } from './resolver.js';
import { getDestination } from '../data/countries/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OVERRIDES_PATH = resolve(HERE, '../data/overrides.json');

export function loadOverrides(path = OVERRIDES_PATH) {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    throw new Error(`overrides.json is not valid JSON: ${error.message}`);
  }
}

/**
 * Apply overrides to a set of manifest records.
 *
 * @returns {{records: Array, applied: Array, problems: Array}}
 */
export function applyOverrides(records, overrides, candidateStore) {
  const byKey = new Map(records.map((r) => [`${r.country}/${r.category}`, r]));
  const applied = [];
  const problems = [];

  for (const [slot, override] of Object.entries(overrides)) {
    const [country, category] = slot.split('/');
    const current = byKey.get(slot);

    if (!current) {
      problems.push(`${slot}: no such slot — check the country and category ids`);
      continue;
    }

    let destination;
    try {
      destination = getDestination(country);
    } catch (error) {
      problems.push(`${slot}: ${error.message}`);
      continue;
    }
    const entry = destination.byCategory[category];
    if (!entry) {
      problems.push(`${slot}: "${category}" is not a category`);
      continue;
    }

    // Form two: pin the slot empty.
    if (override.status === STATUS.UNRESOLVED) {
      byKey.set(
        slot,
        toUnresolved(entry, override.why ?? 'pinned unresolved by a reviewer'),
      );
      applied.push(`${slot}: pinned unresolved`);
      continue;
    }

    if (!override.provider || !override.photoId) {
      problems.push(`${slot}: needs provider and photoId, or status "unresolved"`);
      continue;
    }

    const candidate = findCandidate(
      candidateStore,
      country,
      category,
      override.provider,
      override.photoId,
    );
    if (!candidate) {
      problems.push(
        `${slot}: ${override.provider}:${override.photoId} is not in the candidate ` +
          'store — re-run the resolver for this slot, or pick from the review sheet',
      );
      continue;
    }

    byKey.set(slot, {
      ...toRecord(entry, { candidate, total: candidate.score ?? null, parts: candidate.scoreParts ?? {} }),
      pinned: true,
      pinnedWhy: override.why ?? null,
    });
    applied.push(`${slot}: pinned ${override.provider}:${override.photoId}`);
  }

  return { records: [...byKey.values()], applied, problems };
}

/**
 * Duplicate check that runs AFTER overrides. Pinning by hand is the easiest
 * way to end up using one photograph in two slots, and the ranker's own
 * uniqueness rule cannot see a human decision.
 */
export function findDuplicates(records) {
  const uses = new Map();
  for (const record of records) {
    if (record.status !== STATUS.RESOLVED) continue;
    const key = `${record.provider}:${record.photoId}`;
    if (!uses.has(key)) uses.set(key, []);
    uses.get(key).push(`${record.country}/${record.category}`);
  }
  return [...uses.entries()]
    .filter(([, slots]) => slots.length > 1)
    .map(([key, slots]) => ({ photo: key, slots }));
}
