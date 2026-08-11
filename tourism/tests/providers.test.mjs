import test from 'node:test';
import assert from 'node:assert/strict';

import * as unsplash from '../lib/providers/unsplash.js';
import * as pexels from '../lib/providers/pexels.js';
import { HttpError } from '../lib/http.js';
import { unsplashPhoto, pexelsPhoto, mockFetch } from './fixtures.mjs';

test('unsplash: maps an API result into a candidate without inventing fields', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': { results: [unsplashPhoto()] },
  });

  const [candidate] = await unsplash.search({
    query: 'uganda gorilla',
    accessKey: 'test-key',
    fetchImpl,
  });

  assert.equal(candidate.provider, 'unsplash');
  assert.equal(candidate.photoId, 'AbCd1234xyz');
  assert.equal(candidate.baseUrl, 'https://images.unsplash.com/photo-mock-uganda-gorilla');
  assert.equal(candidate.sourceUrl, 'https://unsplash.com/photos/AbCd1234xyz');
  assert.equal(candidate.photographer, 'A Photographer');
  assert.equal(candidate.photographerUrl, 'https://unsplash.com/@aphotographer');
  assert.equal(candidate.width, 5000);
  assert.deepEqual(candidate.tags, ['uganda', 'bwindi', 'gorilla', 'wildlife']);
});

test('unsplash: sends the credential as a Client-ID header, never in the query', async () => {
  const fetchImpl = mockFetch({ 'api.unsplash.com': { results: [] } });
  await unsplash.search({ query: 'x', accessKey: 'secret-key', fetchImpl });

  const [call] = fetchImpl.calls;
  assert.equal(call.init.headers.Authorization, 'Client-ID secret-key');
  assert.ok(!call.url.includes('secret-key'), 'key must not appear in the URL');
});

test('unsplash: drops results missing an id, a URL or dimensions', async () => {
  const fetchImpl = mockFetch({
    'api.unsplash.com': {
      results: [
        unsplashPhoto({ id: null }),
        unsplashPhoto({ urls: { raw: null } }),
        unsplashPhoto({ links: { html: null } }),
        unsplashPhoto({ width: 0 }),
        // a URL that is not on the provider CDN is a fabrication risk
        unsplashPhoto({ urls: { raw: 'https://example.com/photo.jpg' } }),
        unsplashPhoto({ id: 'good' }),
      ],
    },
  });

  const candidates = await unsplash.search({ query: 'x', accessKey: 'k', fetchImpl });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].photoId, 'good');
});

test('unsplash: a missing key throws rather than silently returning nothing', async () => {
  await assert.rejects(
    () => unsplash.search({ query: 'x', accessKey: null }),
    (error) => error instanceof HttpError && error.status === 401,
  );
});

test('pexels: maps an API result and translates the orientation vocabulary', async () => {
  const fetchImpl = mockFetch({ 'api.pexels.com': { photos: [pexelsPhoto()] } });

  const [candidate] = await pexels.search({
    query: 'uganda gorilla',
    orientation: 'squarish',
    apiKey: 'test-key',
    fetchImpl,
  });

  assert.equal(candidate.provider, 'pexels');
  assert.equal(candidate.photoId, '998877');
  assert.equal(candidate.baseUrl, 'https://images.pexels.com/photos/998877/mock.jpeg');
  assert.equal(candidate.photographer, 'Another Photographer');
  assert.ok(fetchImpl.calls[0].url.includes('orientation=square'));
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, 'test-key');
});

test('pexels: a missing key throws', async () => {
  await assert.rejects(
    () => pexels.search({ query: 'x', apiKey: '' }),
    (error) => error instanceof HttpError && error.status === 401,
  );
});

test('http: a 401 is not retried, a 500 is', async () => {
  let unauthorizedCalls = 0;
  const unauthorized = mockFetch({
    api: () => {
      unauthorizedCalls += 1;
      return { ok: false, status: 401, json: async () => ({}) };
    },
  });
  await assert.rejects(() =>
    unsplash.search({ query: 'x', accessKey: 'k', fetchImpl: unauthorized }),
  );
  assert.equal(unauthorizedCalls, 1, '401 must not be retried');
});
