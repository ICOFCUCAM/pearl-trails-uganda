import test from 'node:test';
import assert from 'node:assert/strict';

import { tourismImage, tourismHero, tourismCategoryGrid, attribution, esc, focalPosition } from '../lib/render.js';
import { toRecord, toUnresolved, STATUS } from '../lib/resolver.js';
import { responsiveSet, variantUrl, assertProviderUrl, previewUrl } from '../lib/cdn.js';
import { emptyManifest, indexManifest } from '../lib/manifest.js';
import { getDestination } from '../data/countries/index.js';
import { getRole, getCategory, roleOf } from '../data/categories.js';

const uganda = getDestination('uganda');

function resolvedRecord(categoryId = 'wildlife', overrides = {}) {
  const entry = uganda.byCategory[categoryId];
  return toRecord(entry, {
    total: 80,
    parts: {},
    candidate: {
      provider: 'unsplash',
      photoId: 'abc123',
      baseUrl: 'https://images.unsplash.com/photo-abc123',
      thumbnailUrl: 'https://images.unsplash.com/photo-abc123?w=200',
      sourceUrl: 'https://unsplash.com/photos/abc123',
      downloadLocation: null,
      photographer: 'A Photographer',
      photographerUrl: 'https://unsplash.com/@ap',
      width: 5000,
      height: 3333,
      color: '#222',
      ...overrides,
    },
  });
}

/* ---------------------------------------------------------------- CDN URLs */

test('variant URLs are the provider URL plus documented parameters only', () => {
  const record = { provider: 'unsplash', baseUrl: 'https://images.unsplash.com/photo-abc123' };
  const url = new URL(variantUrl(record, { width: 1600, aspect: 16 / 9 }));
  assert.equal(url.origin + url.pathname, 'https://images.unsplash.com/photo-abc123');
  assert.equal(url.searchParams.get('w'), '1600');
  assert.equal(url.searchParams.get('h'), '900');
  assert.equal(url.searchParams.get('q'), '85');
  assert.equal(url.searchParams.get('auto'), 'format');
  assert.equal(url.searchParams.get('fit'), 'crop');
});

test('pexels variants use the pexels parameter vocabulary', () => {
  const record = { provider: 'pexels', baseUrl: 'https://images.pexels.com/photos/1/x.jpeg' };
  const url = new URL(variantUrl(record, { width: 800, aspect: 4 / 3 }));
  assert.equal(url.searchParams.get('auto'), 'compress');
  assert.equal(url.searchParams.get('cs'), 'tinysrgb');
  assert.equal(url.searchParams.get('w'), '800');
  assert.equal(url.searchParams.get('h'), '600');
});

test('non-provider hosts and plain http are refused', () => {
  assert.throws(() => assertProviderUrl('https://example.com/photo.jpg'), /Unrecognised image host/);
  assert.throws(() => assertProviderUrl('http://images.unsplash.com/x'), /must be https/);
  assert.throws(() => assertProviderUrl('not a url'), /Not a valid URL/);
});

test('a card asks for small widths and a hero asks for large ones', () => {
  const source = { provider: 'unsplash', baseUrl: 'https://images.unsplash.com/photo-a', width: 5000, height: 3000 };
  const card = responsiveSet(source, 'card');
  const hero = responsiveSet(source, 'hero');

  const widthsOf = (set) => set.srcset.split(',').map((p) => Number(p.trim().split(/\s+/)[1].replace('w', '')));
  assert.equal(Math.max(...widthsOf(card)), 800);
  assert.equal(Math.max(...widthsOf(hero)), 2400);
  assert.ok(hero.loading === 'eager' && card.loading === 'lazy');
});

test('the ladder never asks for more pixels than the source has', () => {
  const small = { provider: 'unsplash', baseUrl: 'https://images.unsplash.com/photo-a', width: 900, height: 600 };
  const set = responsiveSet(small, 'feature');
  const widths = set.srcset.split(',').map((p) => Number(p.trim().split(/\s+/)[1].replace('w', '')));
  assert.ok(Math.max(...widths) <= 900);
});

test('every role declares a ratio, a mobile ratio and a sizes attribute', () => {
  for (const category of ['hero', 'nature', 'wildlife', 'waterfalls', 'adventure']) {
    const role = roleOf(getCategory(category));
    assert.ok(role.ratio && role.mobileRatio && role.sizes, `${category} role incomplete`);
  }
  assert.equal(getRole('hero').aspect, 21 / 9);
});

/* --------------------------------------------------------------- rendering */

test('a resolved record renders a responsive, focal-point aware image', () => {
  const html = tourismImage(resolvedRecord());
  assert.match(html, /<img /);
  assert.match(html, /srcset="[^"]*images\.unsplash\.com/);
  assert.match(html, /sizes="/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /width="\d+" height="\d+"/);
  assert.match(html, /object-position:\d+% \d+%/);
  assert.match(html, /alt="Mountain gorilla resting/);
});

test('a hero image is eager, high priority and preloadable', () => {
  const record = resolvedRecord('hero');
  const html = tourismImage(record, { eager: true });
  assert.match(html, /loading="eager"/);
  assert.match(html, /fetchpriority="high"/);
  assert.ok(previewUrl(record, 1920).includes('w=1920'));
});

test('an unresolved record never renders an <img> and never invents a URL', () => {
  const record = toUnresolved(uganda.byCategory.wildlife, 'no results');
  const html = tourismImage(record);
  assert.ok(!html.includes('<img'), 'must not render an image element');
  assert.ok(!/https?:\/\//.test(html), 'must not contain any URL');
  assert.match(html, /Photograph pending/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="[^"]+"/);
  // The box is still reserved, so resolving later causes no layout shift.
  assert.match(html, /--t-ratio:16 \/ 9/);
});

test('a decorative image is hidden from assistive technology', () => {
  const html = tourismImage(resolvedRecord(), { decorative: true });
  assert.match(html, /alt=""/);
  assert.match(html, /aria-hidden="true"/);
});

test('attribution is emitted for every resolved image and never for an unresolved one', () => {
  const html = attribution(resolvedRecord());
  assert.match(html, /A Photographer/);
  assert.match(html, /unsplash\.com\/@ap/);
  assert.match(html, /Unsplash<\/a>/);
  assert.equal(attribution(toUnresolved(uganda.byCategory.wildlife, 'x')), '');
});

test('markup escapes untrusted provider strings', () => {
  const record = resolvedRecord('wildlife', {
    photographer: 'Ex "quote" <script>alert(1)</script>',
  });
  const html = attribution(record);
  assert.ok(!html.includes('<script>'));
  assert.equal(esc('a & b < c > "d"'), 'a &amp; b &lt; c &gt; &quot;d&quot;');
});

test('focal point drives object-position rather than a blind centre crop', () => {
  const record = resolvedRecord('hero');
  assert.equal(focalPosition(record), '66% 46%');
  assert.notEqual(focalPosition(record), '50% 50%');
});

test('the hero component carries the country tagline and the 27-link', () => {
  const html = tourismHero(uganda, resolvedRecord('hero'));
  assert.match(html, /The Pearl of Africa/);
  assert.match(html, /Uganda/);
  assert.match(html, /#experiences/);
  assert.match(html, /ptu-t-hero-veil/);
});

test('the parallax band adds no property that would break the fixed window', () => {
  const html = tourismHero(uganda, resolvedRecord('hero'));
  for (const banned of ['transform:', 'filter:', 'will-change:', 'backdrop-filter:', 'contain:']) {
    assert.ok(!html.includes(banned), `hero must not emit ${banned}`);
  }
});

test('the 27-category grid renders every category once', () => {
  const index = indexManifest(emptyManifest());
  const html = tourismCategoryGrid(index.forCountry('uganda'), {
    title: 'x',
    note: 'y',
  });
  for (const entry of uganda.categories) {
    assert.ok(html.includes(esc(entry.caption)), `missing caption for ${entry.category}`);
  }
  assert.equal((html.match(/ptu-t-card"/g) ?? []).length, 27);
});

test('an empty manifest still produces a complete, renderable set', () => {
  const index = indexManifest(emptyManifest());
  assert.equal(index.records.length, 15 * 27);
  assert.equal(index.get('uganda', 'hero').status, STATUS.UNRESOLVED);
  assert.equal(index.isResolved('uganda', 'hero'), false);
});
