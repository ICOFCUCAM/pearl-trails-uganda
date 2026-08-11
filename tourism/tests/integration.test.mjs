/**
 * End-to-end: mocked providers -> resolver -> manifest -> generated page.
 *
 * This is the test that proves the system actually produces a photographic
 * tourism page once credentials exist, without any live API call. It runs the
 * real resolver, the real manifest merge and the real page renderer.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveAll, toRecord, STATUS } from '../lib/resolver.js';
import { saveManifest, loadManifest, indexManifest, emptyManifest } from '../lib/manifest.js';
import { auditManifest } from '../lib/validate.js';
import { countryPage, regionPage, rewriteSlots } from '../scripts/build-pages.mjs';
import { getDestination, COUNTRIES } from '../data/countries/index.js';
import { unsplashPhoto, pexelsPhoto, mockFetch } from './fixtures.mjs';

const uganda = getDestination('uganda');

/**
 * A provider mock that returns a distinct, on-topic photograph per request,
 * echoing the query back as the description so the ranker has real signal.
 */
function richProviderFetch({ pexelsEvery = 0 } = {}) {
  let n = 0;
  return mockFetch({
    'api.unsplash.com': (url) => {
      n += 1;
      const query = new URL(url).searchParams.get('query');
      // Every Nth slot, Unsplash "has nothing" so the fallback is exercised.
      if (pexelsEvery && n % pexelsEvery === 0) {
        return { ok: true, status: 200, json: async () => ({ results: [] }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            unsplashPhoto({
              id: `u-${n}`,
              description: query,
              urls: {
                raw: `https://images.unsplash.com/photo-mock-${n}`,
                thumb: `https://images.unsplash.com/photo-mock-${n}?w=200`,
              },
              links: {
                html: `https://unsplash.com/photos/u-${n}`,
                download_location: `https://api.unsplash.com/photos/u-${n}/download`,
              },
              tags: query.split(' ').map((title) => ({ title })),
            }),
          ],
        }),
      };
    },
    'api.pexels.com': (url) => {
      n += 1;
      const query = new URL(url).searchParams.get('query');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          photos: [
            pexelsPhoto({
              id: 900000 + n,
              alt: query,
              src: {
                original: `https://images.pexels.com/photos/${900000 + n}/mock.jpeg`,
                tiny: `https://images.pexels.com/photos/${900000 + n}/mock.jpeg?w=100`,
              },
            }),
          ],
        }),
      };
    },
  });
}

test('full pipeline: resolve Uganda, write the manifest, render the page', async () => {
  const { records, stats } = await resolveAll([uganda], {
    cache: null,
    credentials: { unsplash: 'u', pexels: 'p' },
    fetchImpl: richProviderFetch({ pexelsEvery: 5 }),
  });

  assert.equal(records.length, 27);
  assert.equal(stats.unresolved, 0, 'every Uganda slot should resolve');
  assert.ok(records.some((r) => r.provider === 'unsplash'), 'unsplash used');
  assert.ok(records.some((r) => r.provider === 'pexels'), 'pexels fallback used');

  // Persist and reload through the real manifest layer.
  const dir = mkdtempSync(join(tmpdir(), 'ptu-manifest-'));
  const path = join(dir, 'tourism-images.json');
  const base = emptyManifest();
  const merged = new Map(base.records.map((r) => [`${r.country}::${r.category}`, r]));
  for (const record of records) merged.set(`${record.country}::${record.category}`, record);
  saveManifest([...merged.values()], path);

  const index = indexManifest(loadManifest(path));
  const html = countryPage(uganda, index);

  // Only Uganda was resolved here, so the trailing explorer strip still shows
  // other countries' plates. Everything above it must be photographic.
  const ugandaSections = html.slice(0, html.indexOf('id="explore"'));
  assert.ok(
    !ugandaSections.includes('Photograph pending'),
    'no unresolved plate should remain in Uganda\'s own sections',
  );
  const imgs = ugandaSections.match(/<img\b[^>]*>/g) ?? [];
  assert.ok(imgs.length >= 27, `expected at least 27 images, got ${imgs.length}`);

  for (const img of imgs) {
    assert.match(img, /\balt="[^"]{20,}"/, `weak alt text: ${img.slice(0, 100)}`);
    assert.match(img, /\bsrcset="/, `no srcset: ${img.slice(0, 100)}`);
    assert.match(img, /\bsizes="/, `no sizes: ${img.slice(0, 100)}`);
    assert.match(img, /\bwidth="\d+"\s+height="\d+"/, 'no intrinsic size');
    assert.match(img, /object-position:/, 'no focal point');
    assert.match(
      img,
      /src="https:\/\/images\.(unsplash|pexels)\.com\//,
      `src is not a provider CDN URL: ${img.slice(0, 120)}`,
    );
  }

  // Exactly one eager hero, everything else lazy.
  assert.equal(imgs.filter((i) => i.includes('loading="eager"')).length, 1);

  // Attribution present for every resolved photograph.
  const credits = ugandaSections.match(/ptu-t-credit/g) ?? [];
  assert.ok(credits.length >= 27, `expected >=27 credits, got ${credits.length}`);
  assert.match(html, /A Photographer|Another Photographer/);

  // Hero preload points at a real provider URL.
  assert.match(html, /<link rel="preload" as="image" href="https:\/\/images\./);

  // The fixed-window invariant survives generation.
  for (const banned of ['transform:', 'will-change:', 'backdrop-filter:', 'perspective:']) {
    assert.ok(!html.includes(banned), `generated page emits ${banned}`);
  }

  // The audit is clean on a fully resolved country. Only Uganda's records were
  // passed in, so the other countries' "missing" findings are expected here —
  // that they ARE reported is itself the coverage check working.
  const audit = auditManifest({ records });
  assert.ok(
    audit.issues.some((i) => i.kind === 'missing-image' && i.where === 'kenya'),
    'coverage gaps in other countries must be reported',
  );
  const errors = audit.issues.filter(
    (i) => i.level === 'error' && String(i.where).startsWith('uganda'),
  );
  assert.deepEqual(errors, [], `audit errors: ${JSON.stringify(errors, null, 1)}`);
  assert.equal(audit.byCountry.get('uganda').resolved, 27);
  assert.equal(audit.byCountry.get('uganda').duplicates, 0);
});

test('mixed manifest: resolved and unresolved slots render side by side', async () => {
  const { records } = await resolveAll([uganda], {
    cache: null,
    credentials: { unsplash: 'u', pexels: null },
    fetchImpl: mockFetch({
      // Only the hero query returns anything at all.
      'api.unsplash.com': (url) => {
        const query = new URL(url).searchParams.get('query');
        const isHero = query.includes('misty ridges');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: isHero
              ? [unsplashPhoto({ id: 'hero-1', description: query, tags: query.split(' ').map((t) => ({ title: t })) })]
              : [],
          }),
        };
      },
    }),
  });

  const resolved = records.filter((r) => r.status === STATUS.RESOLVED);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].category, 'hero');

  const base = emptyManifest();
  const merged = new Map(base.records.map((r) => [`${r.country}::${r.category}`, r]));
  for (const record of records) merged.set(`${record.country}::${record.category}`, record);

  const index = indexManifest({ version: 1, generatedAt: null, records: [...merged.values()] });
  const html = countryPage(uganda, index);

  const ugandaSections = html.slice(0, html.indexOf('id="explore"'));
  assert.ok(ugandaSections.includes('Photograph pending'), 'unresolved slots still show a plate');
  assert.ok(ugandaSections.includes('images.unsplash.com'), 'the resolved hero still renders');

  // Exactly one photograph exists, and no other slot silently borrowed it:
  // the hero appears in the hero section and in the 27-grid, and nowhere else.
  const imgs = ugandaSections.match(/<img\b[^>]*>/g) ?? [];
  assert.equal(imgs.length, 2, `expected the hero twice, got ${imgs.length} images`);
  for (const img of imgs) assert.match(img, /photo-mock-uganda-gorilla/);
});

test('every generated page is well-formed enough to serve', () => {
  const index = indexManifest(emptyManifest());
  const pages = [...COUNTRIES.map((c) => countryPage(c, index)), regionPage(index)];

  assert.equal(pages.length, 15);
  for (const html of pages) {
    assert.match(html, /^<!DOCTYPE html>/);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>[^<]{10,}<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{40,}">/);
    assert.match(html, /<link rel="stylesheet" href="\/styles\/tourism\.css">/);
    assert.ok(html.trim().endsWith('</html>'));
    // 27 category cards on every page, every destination.
    assert.equal((html.match(/class="ptu-t-card"/g) ?? []).length, 27);
    // No unbalanced escaping of authored copy.
    assert.ok(!html.includes('undefined'), 'template emitted "undefined"');
    assert.ok(!html.includes('[object Object]'));
  }
});

test('the original pages keep their SVG placeholder while a slot is unresolved', () => {
  const index = indexManifest(emptyManifest());
  const source =
    '<img data-tourism="uganda/wildlife" data-tourism-role="feature" ' +
    'src="/images/services.1.svg" alt="A mountain gorilla in Bwindi" loading="lazy">';

  // An unresolved slot must be left byte-identical: those pages carry their CSS
  // inline and would render an unstyled plate.
  assert.equal(rewriteSlots(source, index), source);
});

test('the original pages take the photograph once the slot resolves, idempotently', () => {
  const base = emptyManifest();
  const resolved = toRecord(uganda.byCategory.wildlife, {
    total: 90,
    parts: {},
    candidate: {
      provider: 'unsplash',
      photoId: 'gor1',
      baseUrl: 'https://images.unsplash.com/photo-gor1',
      thumbnailUrl: null,
      sourceUrl: 'https://unsplash.com/photos/gor1',
      downloadLocation: null,
      photographer: 'P',
      photographerUrl: 'https://unsplash.com/@p',
      width: 5000,
      height: 3333,
      color: null,
    },
  });
  const records = base.records.map((r) =>
    r.country === 'uganda' && r.category === 'wildlife' ? resolved : r,
  );
  const index = indexManifest({ version: 1, generatedAt: null, records });

  const source =
    '<img data-tourism="uganda/wildlife" data-tourism-role="feature" ' +
    'src="/images/services.1.svg" alt="A mountain gorilla in Bwindi" loading="lazy">';

  const once = rewriteSlots(source, index);
  assert.ok(!once.includes('.svg'), 'the placeholder should be gone');
  assert.match(once, /src="https:\/\/images\.unsplash\.com\/photo-gor1/);
  assert.match(once, /data-tourism="uganda\/wildlife"/, 'marker must survive');
  assert.match(once, /data-tourism-role="feature"/);
  assert.match(once, /alt="Mountain gorilla resting/);
  assert.match(once, /srcset="/);

  // Running the build again must not corrupt or nest anything.
  assert.equal(rewriteSlots(once, index), once, 'rewrite must be idempotent');
  assert.equal((once.match(/<img/g) ?? []).length, 1);
});

test('no generated page contains anything resembling a credential', () => {
  const index = indexManifest(emptyManifest());
  const dir = mkdtempSync(join(tmpdir(), 'ptu-pages-'));
  const html = countryPage(uganda, index);
  const path = join(dir, 'uganda.html');
  writeFileSync(path, html, 'utf8');

  const written = readFileSync(path, 'utf8');
  for (const needle of ['UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY', 'Client-ID', 'Authorization']) {
    assert.ok(!written.includes(needle), `page leaks ${needle}`);
  }
});
