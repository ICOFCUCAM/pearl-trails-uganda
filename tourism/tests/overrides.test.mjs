import test from 'node:test';
import assert from 'node:assert/strict';

import { applyOverrides, findDuplicates } from '../lib/overrides.js';
import { shortlistFor, findCandidate, saveCandidates, loadCandidates } from '../lib/candidates.js';
import { emptyManifest } from '../lib/manifest.js';
import { resolveAll, STATUS } from '../lib/resolver.js';
import { getDestination } from '../data/countries/index.js';
import { unsplashPhoto, mockFetch } from './fixtures.mjs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const uganda = getDestination('uganda');

/** A candidate store holding two options for uganda/wildlife. */
function storeWithTwo() {
  return {
    version: 1,
    slots: {
      'uganda::wildlife': {
        country: 'uganda',
        category: 'wildlife',
        shortlist: [
          {
            provider: 'unsplash', photoId: 'ranked-first',
            baseUrl: 'https://images.unsplash.com/photo-a',
            sourceUrl: 'https://unsplash.com/photos/a',
            photographer: 'A', photographerUrl: 'https://unsplash.com/@a',
            width: 4000, height: 2600, score: 71, scoreParts: { country: 18 }, accepted: true,
          },
          {
            provider: 'unsplash', photoId: 'human-prefers',
            baseUrl: 'https://images.unsplash.com/photo-b',
            sourceUrl: 'https://unsplash.com/photos/b',
            photographer: 'B', photographerUrl: 'https://unsplash.com/@b',
            width: 5000, height: 3300, score: 64, scoreParts: { country: 18 }, accepted: true,
          },
        ],
      },
    },
  };
}

function manifestRecords() {
  return emptyManifest().records;
}

test('an override pins a runner-up over the ranker\'s pick', () => {
  const { records, applied, problems } = applyOverrides(
    manifestRecords(),
    { 'uganda/wildlife': { provider: 'unsplash', photoId: 'human-prefers', why: 'better light' } },
    storeWithTwo(),
  );

  assert.deepEqual(problems, []);
  assert.equal(applied.length, 1);

  const record = records.find((r) => r.country === 'uganda' && r.category === 'wildlife');
  assert.equal(record.status, STATUS.RESOLVED);
  assert.equal(record.photoId, 'human-prefers');
  assert.equal(record.pinned, true);
  assert.equal(record.pinnedWhy, 'better light');
  // Authored copy survives the override untouched.
  assert.equal(record.caption, 'Wild Encounters');
  assert.match(record.imageUrl, /^https:\/\/images\.unsplash\.com\/photo-b/);
});

test('applying an override needs no API call — the candidate is already on disk', () => {
  const store = storeWithTwo();
  const candidate = findCandidate(store, 'uganda', 'wildlife', 'unsplash', 'human-prefers');
  assert.ok(candidate, 'the pool an override draws from');
  assert.equal(shortlistFor(store, 'uganda', 'wildlife').length, 2);
  assert.equal(findCandidate(store, 'uganda', 'wildlife', 'unsplash', 'never-seen'), null);
});

test('pinning a photo that was never a candidate fails loudly', () => {
  const { applied, problems, records } = applyOverrides(
    manifestRecords(),
    { 'uganda/wildlife': { provider: 'unsplash', photoId: 'invented-id' } },
    storeWithTwo(),
  );
  assert.equal(applied.length, 0);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not in the candidate store/);
  // The slot is untouched rather than filled with something made up.
  const record = records.find((r) => r.country === 'uganda' && r.category === 'wildlife');
  assert.equal(record.status, STATUS.UNRESOLVED);
});

test('a reviewer can pin a slot empty when nothing is good enough', () => {
  const { records, applied, problems } = applyOverrides(
    manifestRecords(),
    { 'uganda/beaches': { status: 'unresolved', why: 'every result is an ocean beach' } },
    storeWithTwo(),
  );
  assert.deepEqual(problems, []);
  assert.equal(applied[0], 'uganda/beaches: pinned unresolved');

  const record = records.find((r) => r.country === 'uganda' && r.category === 'beaches');
  assert.equal(record.status, STATUS.UNRESOLVED);
  assert.equal(record.reason, 'every result is an ocean beach');
  assert.equal(record.imageUrl, null);
});

test('typos in a slot key are reported, not ignored', () => {
  const { problems } = applyOverrides(
    manifestRecords(),
    {
      'uganda/wildife': { provider: 'unsplash', photoId: 'x' },
      'atlantis/wildlife': { provider: 'unsplash', photoId: 'x' },
      'uganda/hero': { why: 'forgot the photoId' },
    },
    storeWithTwo(),
  );
  assert.equal(problems.length, 3);
  assert.match(problems.join('\n'), /no such slot/);
  assert.match(problems.join('\n'), /needs provider and photoId/);
});

test('duplicates introduced by hand-pinning are caught', () => {
  const store = storeWithTwo();
  store.slots['uganda::safari'] = {
    country: 'uganda',
    category: 'safari',
    shortlist: [store.slots['uganda::wildlife'].shortlist[1]],
  };

  const { records } = applyOverrides(
    manifestRecords(),
    {
      'uganda/wildlife': { provider: 'unsplash', photoId: 'human-prefers' },
      'uganda/safari': { provider: 'unsplash', photoId: 'human-prefers' },
    },
    store,
  );

  const duplicates = findDuplicates(records);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].slots, ['uganda/wildlife', 'uganda/safari']);
});

test('no overrides leaves every record exactly as it was', () => {
  const before = manifestRecords();
  const { records, applied, problems } = applyOverrides(before, {}, storeWithTwo());
  assert.deepEqual(applied, []);
  assert.deepEqual(problems, []);
  assert.equal(records.length, before.length);
});

test('the resolver records its shortlist, and it round-trips through disk', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': {
      results: [
        unsplashPhoto({ id: 'first', description: 'uganda bwindi gorilla wildlife rainforest' }),
        unsplashPhoto({
          id: 'second',
          description: 'uganda bwindi gorilla wildlife',
          urls: { raw: 'https://images.unsplash.com/photo-second' },
          links: { html: 'https://unsplash.com/photos/second' },
        }),
      ],
    },
  });

  const { candidates } = await resolveAll([uganda], {
    cache: null,
    credentials: { unsplash: 'u', pexels: null },
    fetchImpl,
    categories: ['wildlife'],
  });

  const slot = candidates['uganda::wildlife'];
  assert.ok(slot, 'the shortlist should be handed back');
  assert.equal(slot.considered, 2);
  assert.equal(slot.shortlist.length, 2);
  assert.ok(slot.shortlist[0].score >= slot.shortlist[1].score, 'best first');
  assert.ok(typeof slot.shortlist[0].scoreParts.country === 'number');

  const path = join(mkdtempSync(join(tmpdir(), 'ptu-cand-')), 'candidates.json');
  saveCandidates(candidates, path);
  const reloaded = loadCandidates(path);
  assert.equal(shortlistFor(reloaded, 'uganda', 'wildlife').length, 2);
  assert.ok(findCandidate(reloaded, 'uganda', 'wildlife', 'unsplash', 'second'));
});

test('a corrupt candidate store degrades to empty rather than throwing', () => {
  assert.deepEqual(loadCandidates('/nonexistent/candidates.json'), {
    version: 1, generatedAt: null, slots: {},
  });
});
