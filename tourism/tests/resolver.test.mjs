import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveEntry, resolveAll, STATUS } from '../lib/resolver.js';
import { getDestination, ALL_DESTINATIONS } from '../data/countries/index.js';
import { loadCache, readCache, writeCache, cacheKey } from '../lib/cache.js';
import { unsplashPhoto, pexelsPhoto, mockFetch } from './fixtures.mjs';

const uganda = getDestination('uganda');
const entry = uganda.byCategory.wildlife;

const BOTH_KEYS = { unsplash: 'u-key', pexels: 'p-key' };

test('unsplash success: resolves from the primary provider', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': { results: [unsplashPhoto()] },
  });

  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    fetchImpl,
  });

  assert.equal(record.status, STATUS.RESOLVED);
  assert.equal(record.provider, 'unsplash');
  assert.equal(record.photoId, 'AbCd1234xyz');
  assert.equal(record.caption, 'Wild Encounters');
  assert.ok(record.imageUrl.startsWith('https://images.unsplash.com/'));
  assert.ok(record.srcset.includes('w='));
  assert.equal(record.photographer, 'A Photographer');
  assert.ok(record.sourceUrl);
  assert.deepEqual(Object.keys(record.focalPoint), ['x', 'y']);
  // Pexels must not have been touched when Unsplash succeeded.
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('pexels')));
});

test('pexels fallback: used when unsplash returns nothing usable', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': { results: [] },
    'api.pexels.com': { photos: [pexelsPhoto()] },
  });

  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    fetchImpl,
  });

  assert.equal(record.status, STATUS.RESOLVED);
  assert.equal(record.provider, 'pexels');
  assert.ok(record.imageUrl.startsWith('https://images.pexels.com/'));
  assert.ok(fetchImpl.calls.some((c) => c.url.includes('unsplash')), 'unsplash tried first');
});

test('pexels fallback: used when every unsplash candidate is the wrong country', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': {
      results: [
        unsplashPhoto({
          id: 'wrong',
          description: 'Lions on the Serengeti plains in Tanzania',
          tags: [{ title: 'serengeti' }, { title: 'tanzania' }],
        }),
      ],
    },
    'api.pexels.com': { photos: [pexelsPhoto()] },
  });

  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    fetchImpl,
  });

  assert.equal(record.provider, 'pexels', 'a Serengeti photo cannot represent Uganda');
});

test('no suitable image anywhere: unresolved, with a reason and no URL', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': { results: [] },
    'api.pexels.com': { photos: [] },
  });

  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    fetchImpl,
  });

  assert.equal(record.status, STATUS.UNRESOLVED);
  assert.equal(record.imageUrl, null);
  assert.equal(record.photoId, null);
  assert.equal(record.provider, null);
  assert.match(record.reason, /no results/);
  // The authored copy survives so the page can still say something true.
  assert.equal(record.caption, 'Wild Encounters');
  assert.ok(record.alt.length > 20);
});

test('missing API keys: unresolved, never fabricated', async () => {
  const record = await resolveEntry(entry, uganda, {
    credentials: { unsplash: null, pexels: null },
    fetchImpl: mockFetch({}),
  });

  assert.equal(record.status, STATUS.UNRESOLVED);
  assert.equal(record.imageUrl, null);
  assert.match(record.reason, /no API key configured/);
});

test('a missing unsplash key promotes pexels rather than failing', async () => {
  const fetchImpl = mockFetch({ 'api.pexels.com': { photos: [pexelsPhoto()] } });
  const record = await resolveEntry(entry, uganda, {
    credentials: { unsplash: null, pexels: 'p-key' },
    fetchImpl,
  });
  assert.equal(record.provider, 'pexels');
});

test('--provider pexels skips unsplash entirely', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': { results: [unsplashPhoto()] },
    'api.pexels.com': { photos: [pexelsPhoto()] },
  });
  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    only: 'pexels',
    fetchImpl,
  });
  assert.equal(record.provider, 'pexels');
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('unsplash')));
});

test('a provider error falls through to the fallback instead of throwing', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': { status: 401 },
    'api.pexels.com': { photos: [pexelsPhoto()] },
  });
  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    fetchImpl,
  });
  assert.equal(record.provider, 'pexels');
});

test('an invalid provider URL is rejected before it can reach the manifest', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': {
      results: [unsplashPhoto({ urls: { raw: 'http://images.unsplash.com/photo-x' } })],
    },
    'api.pexels.com': { photos: [] },
  });
  const record = await resolveEntry(entry, uganda, {
    credentials: BOTH_KEYS,
    fetchImpl,
  });
  assert.equal(record.status, STATUS.UNRESOLVED);
});

test('duplicate detection holds across a whole run', async () => {
  // One photograph, many slots: only the first slot may take it.
  const fetchImpl = mockFetch({
    'api.unsplash.com': { results: [unsplashPhoto()] },
    'api.pexels.com': { photos: [] },
  });

  const { records } = await resolveAll([uganda], {
    cache: null,
    credentials: BOTH_KEYS,
    fetchImpl,
    categories: ['wildlife', 'safari', 'nature'],
  });

  const resolved = records.filter((r) => r.status === STATUS.RESOLVED);
  assert.equal(resolved.length, 1, 'the same photo must not fill three slots');
  const ids = new Set(resolved.map((r) => `${r.provider}:${r.photoId}`));
  assert.equal(ids.size, resolved.length);
});

test('the cache short-circuits a second run', async () => {
  const cache = { version: 1, entries: {} };
  const fetchImpl = mockFetch({ 'api.unsplash.com': { results: [unsplashPhoto()] } });

  const first = await resolveAll([uganda], {
    cache,
    credentials: BOTH_KEYS,
    fetchImpl,
    categories: ['wildlife'],
  });
  const callsAfterFirst = fetchImpl.calls.length;
  assert.equal(first.stats.resolved, 1);

  const second = await resolveAll([uganda], {
    cache,
    credentials: BOTH_KEYS,
    fetchImpl,
    categories: ['wildlife'],
  });
  assert.equal(second.stats.fromCache, 1);
  assert.equal(fetchImpl.calls.length, callsAfterFirst, 'no new requests');
});

test('--force bypasses the cache', async () => {
  const cache = { version: 1, entries: {} };
  const fetchImpl = mockFetch({ 'api.unsplash.com': { results: [unsplashPhoto()] } });

  await resolveAll([uganda], {
    cache, credentials: BOTH_KEYS, fetchImpl, categories: ['wildlife'],
  });
  const before = fetchImpl.calls.length;
  await resolveAll([uganda], {
    cache, credentials: BOTH_KEYS, fetchImpl, categories: ['wildlife'], force: true,
  });
  assert.ok(fetchImpl.calls.length > before);
});

test('an expired cache entry is treated as absent', () => {
  const cache = { version: 1, entries: {} };
  writeCache(cache, entry, { status: 'resolved', resolvedAt: '2000-01-01T00:00:00.000Z' });
  assert.equal(readCache(cache, entry), null);
  assert.ok(cacheKey(entry).startsWith('uganda::wildlife::'));
});

test('a corrupt cache file degrades to empty rather than throwing', () => {
  const cache = loadCache('/nonexistent/path/cache.json');
  assert.deepEqual(cache, { version: 1, entries: {} });
});

test('every destination resolves all 27 categories in one pass', async () => {
  // Each request returns a distinct photo so uniqueness cannot starve the run.
  let n = 0;
  const fetchImpl = mockFetch({
    'api.unsplash.com': () => {
      n += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            unsplashPhoto({
              id: `photo-${n}`,
              description: 'Uganda Bwindi landscape wildlife culture mountain lake forest',
              tags: [{ title: 'uganda' }, { title: 'bwindi' }],
            }),
          ],
        }),
      };
    },
  });

  const { records } = await resolveAll([uganda], {
    cache: null,
    credentials: BOTH_KEYS,
    fetchImpl,
  });

  assert.equal(records.length, 27);
  assert.equal(new Set(records.map((r) => r.category)).size, 27);
});

test('the register holds fourteen countries plus the region', () => {
  assert.equal(ALL_DESTINATIONS.length, 15);
  const slugs = ALL_DESTINATIONS.map((d) => d.slug);
  for (const expected of [
    'uganda', 'kenya', 'tanzania', 'rwanda', 'burundi', 'south-sudan',
    'ethiopia', 'somalia', 'djibouti', 'eritrea', 'comoros', 'seychelles',
    'mauritius', 'madagascar', 'east-africa',
  ]) {
    assert.ok(slugs.includes(expected), `missing ${expected}`);
  }
  assert.ok(!slugs.includes('cameroon'), 'Cameroon is not part of East Africa here');
});
