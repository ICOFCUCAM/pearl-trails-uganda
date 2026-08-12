import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SYNTHETIC_ALLOWED_CATEGORIES,
  REAL_ONLY_CATEGORIES,
  PROVIDER_PREFERENCE,
  VISUAL_DISCLOSURE,
  SYNTHETIC_PROVIDER,
  syntheticEligibility,
  namesSpecificPlace,
  policyConflicts,
  eligibleSlots,
  isRealProvider,
} from '../data/synthetic-policy.js';
import { lookup, assertSyntheticSrc, isSyntheticSrc } from '../lib/providers/synthetic.js';
import { toSyntheticRecord, resolveEntry, STATUS } from '../lib/resolver.js';
import { auditManifest } from '../lib/validate.js';
import { attribution } from '../lib/render.js';
import { responsiveSet } from '../lib/cdn.js';
import { emptyManifest } from '../lib/manifest.js';
import { ALL_DESTINATIONS, getDestination } from '../data/countries/index.js';
import { CATEGORY_IDS } from '../data/categories.js';
import { mockFetch } from './fixtures.mjs';

const uganda = getDestination('uganda');
const region = getDestination('east-africa');

/* ------------------------------------------------------------------ policy */

test('the allowlist and the protected list are consistent and cover all 27', () => {
  const { conflicts, unknown, uncovered } = policyConflicts();
  assert.deepEqual(conflicts, [], 'a category is both allowed and protected');
  assert.deepEqual(unknown, [], 'policy names a category that does not exist');
  assert.deepEqual(uncovered, [], 'a category is in neither list');
  assert.equal(
    SYNTHETIC_ALLOWED_CATEGORIES.length + REAL_ONLY_CATEGORIES.length,
    CATEGORY_IDS.length,
  );
});

test('every category the decision protects is real-photography-only', () => {
  // The list from the Afrinkong authenticity decision, mapped to category ids.
  const mustBeReal = [
    'people', 'culture', 'family', 'locallife', 'festivals', 'crafts', 'food',
    'wildlife', 'safari', 'heritage', 'historic', 'cities', 'architecture',
    'mountains', 'waterfalls', 'lakes', 'beaches',
  ];
  for (const id of mustBeReal) {
    assert.ok(REAL_ONLY_CATEGORIES.includes(id), `${id} must be real-only`);
    assert.ok(
      !SYNTHETIC_ALLOWED_CATEGORIES.includes(id),
      `${id} must never be synthetic-allowed`,
    );
  }
});

test('permission is never inferred — every slot is refused by default', () => {
  let allowed = 0;
  for (const destination of ALL_DESTINATIONS) {
    for (const entry of destination.categories) {
      if (syntheticEligibility(entry, destination).allowed) allowed += 1;
    }
  }
  const total = ALL_DESTINATIONS.length * 27;
  assert.ok(allowed > 0, 'the gate must not be so tight the provider is dead');
  assert.ok(
    allowed / total < 0.05,
    `synthetic eligible for ${allowed}/${total} slots — too permissive`,
  );
});

test('a hero for a specific country requires real photography', () => {
  const { allowed, reasons } = syntheticEligibility(uganda.byCategory.hero, uganda);
  assert.equal(allowed, false);
  assert.match(reasons.join(' '), /specific destination/);
});

test('naming a real place overrides the category allowlist', () => {
  // uganda/scenic is an allowed CATEGORY, but its subject names Ishasha and
  // the Rwenzori, so it must fall back to real photography.
  assert.ok(SYNTHETIC_ALLOWED_CATEGORIES.includes('scenic'));
  const { allowed, reasons } = syntheticEligibility(uganda.byCategory.scenic, uganda);
  assert.equal(allowed, false);
  assert.match(reasons.join(' '), /recognisable place/);

  const hits = namesSpecificPlace(uganda.byCategory.scenic, uganda);
  assert.ok(hits.includes('ishasha'));
  assert.ok(hits.includes('rwenzori'));
});

test('a destination\'s own name is not treated as a specific location', () => {
  // Every search query leads with the country name; counting it would refuse
  // all 405 slots and make the allowlist decorative.
  const hits = namesSpecificPlace(
    { subject: 'broad open country under high cloud', searchQuery: 'uganda landscape' },
    uganda,
  );
  assert.deepEqual(hits, [], `country name counted as a landmark: ${hits}`);
});

test('species names still block synthetic — a generated shoebill is a false record', () => {
  const hits = namesSpecificPlace(uganda.byCategory.whyvisit, uganda);
  assert.ok(hits.includes('shoebill'));
  assert.equal(syntheticEligibility(uganda.byCategory.whyvisit, uganda).allowed, false);
});

test('real providers come before synthetic in the preference order', () => {
  assert.deepEqual([...PROVIDER_PREFERENCE], ['unsplash', 'pexels', 'synthetic']);
  assert.equal(PROVIDER_PREFERENCE.indexOf(SYNTHETIC_PROVIDER), PROVIDER_PREFERENCE.length - 1);
  assert.ok(isRealProvider('unsplash') && isRealProvider('pexels'));
  assert.ok(!isRealProvider('synthetic'));
});

/* ---------------------------------------------------------------- provider */

function fixtureDir(sidecar, { ext = '.webp', stem = 'east-africa-scenic' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ptu-synth-'));
  writeFileSync(join(dir, `${stem}${ext}`), 'not-a-real-image');
  if (sidecar !== null) {
    writeFileSync(join(dir, `${stem}.json`), JSON.stringify(sidecar));
  }
  return dir;
}

const GOOD_SIDECAR = {
  generationPrompt: 'Cinematic atmospheric interpretation, no recognisable location',
  generationModel: 'example-image-model-v3',
  generatedAt: '2026-08-12T09:14:00Z',
  width: 2400,
  height: 1350,
  dominantColor: '#2b3a2e',
};

const SCENIC_ENTRY = { country: 'east-africa', category: 'scenic' };

test('a synthetic candidate carries its generation record and no attribution', () => {
  const dir = fixtureDir(GOOD_SIDECAR);
  const { candidate, problems } = lookup(SCENIC_ENTRY, { dir });

  assert.deepEqual(problems, []);
  assert.equal(candidate.provider, 'synthetic');
  assert.equal(candidate.synthetic, true);
  assert.equal(candidate.sourceType, 'generated');
  assert.equal(candidate.generationModel, 'example-image-model-v3');
  assert.equal(candidate.visualDisclosure, VISUAL_DISCLOSURE);

  // The four fields that would make it look like a photograph.
  assert.equal(candidate.photographer, null);
  assert.equal(candidate.photographerUrl, null);
  assert.equal(candidate.sourceUrl, null);
  assert.equal(candidate.downloadLocation, null);
});

test('a synthetic image without its sidecar cannot be published', () => {
  const dir = fixtureDir(null);
  const { candidate, problems } = lookup(SCENIC_ENTRY, { dir });
  assert.equal(candidate, null);
  assert.match(problems[0], /no east-africa-scenic\.json sidecar/);
});

test('an incomplete generation record is refused', () => {
  const dir = fixtureDir({ ...GOOD_SIDECAR, generationModel: undefined, generatedAt: undefined });
  const { candidate, problems } = lookup(SCENIC_ENTRY, { dir });
  assert.equal(candidate, null);
  assert.match(problems[0], /missing: generationModel, generatedAt/);
});

test('a sidecar that tries to claim a photographer is refused outright', () => {
  for (const field of ['photographer', 'photographerUrl', 'sourceUrl', 'provider']) {
    const dir = fixtureDir({ ...GOOD_SIDECAR, [field]: 'someone' });
    const { candidate, problems } = lookup(SCENIC_ENTRY, { dir });
    assert.equal(candidate, null, `${field} should disqualify`);
    assert.match(problems[0], new RegExp(`sets "${field}"`));
  }
});

test('synthetic images must live under /assets/synthetic/', () => {
  assert.ok(isSyntheticSrc('/assets/synthetic/east-africa-scenic.webp'));
  assert.ok(!isSyntheticSrc('https://images.unsplash.com/photo-x'));
  assert.equal(
    assertSyntheticSrc('/assets/synthetic/a-b.webp'),
    '/assets/synthetic/a-b.webp',
  );
  for (const bad of [
    'https://images.unsplash.com/photo-x',
    '/assets/synthetic/../../etc/passwd',
    '/assets/synthetic/x.svg',
    '/uploads/x.webp',
  ]) {
    assert.throws(() => assertSyntheticSrc(bad), `should reject ${bad}`);
  }
});

/* ------------------------------------------------------------------ record */

function syntheticRecord(overrides = {}) {
  const dir = fixtureDir(GOOD_SIDECAR);
  const { candidate } = lookup(SCENIC_ENTRY, { dir });
  const entry = region.byCategory.scenic;
  return { ...toSyntheticRecord(entry, candidate), ...overrides };
}

test('the synthetic record nulls every attribution field rather than omitting it', () => {
  const record = syntheticRecord();
  for (const field of ['sourceUrl', 'downloadLocation', 'photographer', 'photographerUrl']) {
    assert.ok(field in record, `${field} should be present as an explicit null`);
    assert.equal(record[field], null);
  }
  assert.equal(record.synthetic, true);
  assert.equal(record.provider, 'synthetic');
  assert.equal(record.sourceType, 'generated');
  assert.equal(record.visualDisclosure, VISUAL_DISCLOSURE);
  assert.equal(record.status, STATUS.RESOLVED);
  assert.match(record.imageUrl, /^\/assets\/synthetic\//);
});

test('a synthetic record is served as committed — no CDN resizing', () => {
  const shaped = responsiveSet(syntheticRecord(), 'parallax');
  assert.equal(shaped.srcset, null, 'there is no CDN to build a srcset from');
  assert.match(shaped.src, /^\/assets\/synthetic\//);
  assert.equal(shaped.width, 2400);
});

/* ------------------------------------------------------------------ render */

test('a synthetic image renders the disclosure where the credit would be', () => {
  const html = attribution(syntheticRecord());
  assert.match(html, /Illustrative image — not a photograph of the destination\./);
  assert.match(html, /is-synthetic/);
  assert.ok(!/Photograph /.test(html), 'must not say "Photograph"');
  assert.ok(!/Unsplash|Pexels/.test(html));
  assert.ok(!/<a /.test(html), 'no source link — there is no source');
});

test('a real photograph still renders a full credit', () => {
  const html = attribution({
    status: STATUS.RESOLVED,
    provider: 'unsplash',
    photographer: 'Jane Doe',
    photographerUrl: 'https://unsplash.com/@jane',
    sourceUrl: 'https://unsplash.com/photos/x',
  });
  assert.match(html, /Photograph/);
  assert.match(html, /Jane Doe/);
  assert.match(html, /Unsplash/);
});

/* ------------------------------------------------------------------- audit */

function auditOne(record) {
  const manifest = emptyManifest();
  const records = manifest.records.map((r) =>
    r.country === record.country && r.category === record.category ? record : r,
  );
  return auditManifest({ ...manifest, records })
    .issues.filter((i) => i.level === 'error')
    .filter((i) => i.where === `${record.country}/${record.category}`);
}

test('a well-formed synthetic record in an allowed slot passes the audit', () => {
  const errors = auditOne(syntheticRecord());
  assert.deepEqual(errors.map((e) => e.message), [], JSON.stringify(errors));
});

test('the build fails if a synthetic image carries a photographer', () => {
  const errors = auditOne(syntheticRecord({ photographer: 'Invented Name' }));
  assert.ok(errors.some((e) => e.kind === 'authenticity' && /credits "Invented Name"/.test(e.message)));
});

test('the build fails if a synthetic image carries a stock source URL', () => {
  const errors = auditOne(
    syntheticRecord({ sourceUrl: 'https://unsplash.com/photos/x' }),
  );
  assert.ok(errors.some((e) => /sourceUrl/.test(e.message)));
});

test('the build fails if a synthetic image points at a stock CDN', () => {
  const errors = auditOne(
    syntheticRecord({ baseUrl: 'https://images.pexels.com/photos/1/x.jpg' }),
  );
  assert.ok(errors.some((e) => /points at a stock provider/.test(e.message)));
});

test('the build fails if the disclosure is missing or altered', () => {
  assert.ok(
    auditOne(syntheticRecord({ visualDisclosure: null })).some((e) =>
      /no visualDisclosure/.test(e.message),
    ),
  );
  assert.ok(
    auditOne(syntheticRecord({ visualDisclosure: 'A nice picture' })).some((e) =>
      /has been altered/.test(e.message),
    ),
  );
});

test('the build fails if the generation record is incomplete', () => {
  for (const field of ['generationPrompt', 'generationModel', 'generatedAt']) {
    const errors = auditOne(syntheticRecord({ [field]: null }));
    assert.ok(
      errors.some((e) => new RegExp(`no ${field}`).test(e.message)),
      `${field} should be required`,
    );
  }
});

test('the build fails if a synthetic image lands in a real-only category', () => {
  const record = { ...syntheticRecord(), country: 'uganda', category: 'people', role: 'portrait' };
  const errors = auditOne(record);
  assert.ok(
    errors.some((e) => /real-photography-only/.test(e.message)),
    JSON.stringify(errors),
  );
});

test('a hand-edited manifest cannot smuggle synthetic into a place-specific slot', () => {
  const record = { ...syntheticRecord(), country: 'uganda', category: 'scenic', role: 'parallax' };
  const errors = auditOne(record);
  assert.ok(errors.some((e) => /synthetic not permitted/.test(e.message)));
});

test('the four synthetic flags must agree — half-synthetic is a build failure', () => {
  assert.ok(
    auditOne(syntheticRecord({ synthetic: false })).some((e) =>
      /synthetic !== true/.test(e.message),
    ),
  );
  assert.ok(
    auditOne(syntheticRecord({ sourceType: 'photograph' })).some((e) =>
      /sourceType/.test(e.message),
    ),
  );
});

test('a real record is still held to the photographic requirements', () => {
  const errors = auditOne({
    ...emptyManifest().records.find((r) => r.country === 'uganda' && r.category === 'people'),
    status: STATUS.RESOLVED,
    provider: 'unsplash',
    photoId: 'x',
    imageUrl: 'https://images.unsplash.com/photo-x',
    baseUrl: 'https://images.unsplash.com/photo-x',
    width: 2000,
    height: 3000,
    photographer: null,
    sourceUrl: null,
  });
  assert.ok(errors.some((e) => e.kind === 'missing-attribution'));
});

/* ---------------------------------------------------------------- resolver */

test('a real photograph is preferred even when synthetic is available', async () => {
  // east-africa/scenic is synthetic-eligible AND genuinely has a valid
  // synthetic image on disk — but Unsplash returns something acceptable, so
  // the photograph wins. This is the preference order doing real work.
  const dir = fixtureDir(GOOD_SIDECAR);
  const { candidate } = lookup(SCENIC_ENTRY, { dir });
  assert.ok(candidate, 'the synthetic image must really be available');

  const fetchImpl = mockFetch({
    'api.unsplash.com': {
      results: [
        {
          id: 'real-one',
          description: 'east africa great rift valley escarpment landscape scenic',
          width: 5000, height: 2800, likes: 500, color: '#333',
          urls: { raw: 'https://images.unsplash.com/photo-real', thumb: '' },
          links: { html: 'https://unsplash.com/photos/real-one', download_location: null },
          user: { name: 'Real Photographer', links: { html: 'https://unsplash.com/@real' } },
          tags: [{ title: 'landscape' }, { title: 'africa' }],
        },
      ],
    },
  });

  const record = await resolveEntry(region.byCategory.scenic, region, {
    credentials: { unsplash: 'key', pexels: null },
    fetchImpl,
    syntheticDir: dir,
  });

  assert.equal(record.provider, 'unsplash');
  assert.notEqual(record.synthetic, true);
  assert.equal(record.photographer, 'Real Photographer');
});

test('synthetic is never consulted for a slot the policy refuses', async () => {
  const lines = [];
  const fetchImpl = mockFetch({ 'api.unsplash.com': { results: [] } });

  const record = await resolveEntry(uganda.byCategory.people, uganda, {
    credentials: { unsplash: 'key', pexels: null },
    fetchImpl,
    log: (l) => lines.push(l),
  });

  assert.equal(record.status, STATUS.UNRESOLVED);
  assert.notEqual(record.synthetic, true);
  assert.match(lines.join('\n'), /synthetic not permitted here/);
});

test('an unresolved slot stays unresolved rather than taking a synthetic image', async () => {
  // uganda/scenic: real providers find nothing, and the policy refuses
  // synthetic because the subject names the Rwenzori. Honest emptiness.
  const record = await resolveEntry(uganda.byCategory.scenic, uganda, {
    credentials: { unsplash: 'key', pexels: null },
    fetchImpl: mockFetch({ 'api.unsplash.com': { results: [] } }),
  });
  assert.equal(record.status, STATUS.UNRESOLVED);
  assert.equal(record.imageUrl, null);
});

test('synthetic fills an allowed slot only after both real providers fail', async () => {
  const dir = fixtureDir(GOOD_SIDECAR);
  const record = await resolveEntry(region.byCategory.scenic, region, {
    credentials: { unsplash: 'key', pexels: 'key' },
    fetchImpl: mockFetch({ 'api.unsplash.com': { results: [] }, 'api.pexels.com': { photos: [] } }),
    syntheticDir: dir,
  });

  assert.equal(record.provider, 'synthetic');
  assert.equal(record.synthetic, true);
  assert.equal(record.photographer, null);
  assert.equal(record.visualDisclosure, VISUAL_DISCLOSURE);
  assert.equal(record.status, STATUS.RESOLVED);
});

test('eligibleSlots names exactly the slots that could ever be synthetic', () => {
  const slots = eligibleSlots(ALL_DESTINATIONS);
  for (const slot of slots) {
    assert.ok(SYNTHETIC_ALLOWED_CATEGORIES.includes(slot.category));
    const destination = ALL_DESTINATIONS.find((d) => d.slug === slot.country);
    assert.equal(syntheticEligibility(destination.byCategory[slot.category], destination).allowed, true);
  }
  // No people-adjacent category can appear, whatever the country.
  for (const slot of slots) {
    assert.ok(!['people', 'culture', 'family', 'locallife', 'festivals', 'crafts'].includes(slot.category));
  }
});
