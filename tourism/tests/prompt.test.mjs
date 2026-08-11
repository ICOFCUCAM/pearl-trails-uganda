import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBrief, briefsFor, briefToText, __test__ } from '../lib/prompt.js';
import { ALL_DESTINATIONS, getDestination } from '../data/countries/index.js';
import { CATEGORY_IDS, roleOf, getCategory } from '../data/categories.js';

const uganda = getDestination('uganda');

test('every destination gets a complete brief for all 27 slots', () => {
  for (const destination of ALL_DESTINATIONS) {
    const briefs = briefsFor(destination);
    assert.equal(briefs.length, 27, `${destination.slug} brief count`);
    assert.equal(new Set(briefs.map((b) => b.category)).size, 27);

    for (const brief of briefs) {
      for (const field of ['prompt', 'negativePrompt', 'aspectRatio', 'composition', 'caption', 'alt']) {
        assert.ok(brief[field], `${destination.slug}/${brief.category} missing ${field}`);
      }
      assert.ok(brief.prompt.length > 80, 'prompt is too thin to direct a generator');
      assert.ok(brief.minimumWidth >= 400);
      assert.ok(CATEGORY_IDS.includes(brief.category));
    }
  }
});

test('the brief leads with the subject, then names the country', () => {
  const brief = buildBrief(uganda.byCategory.wildlife, uganda);
  assert.ok(
    brief.prompt.startsWith('mountain gorilla resting in the undergrowth'),
    `prompt should lead with the subject, got: ${brief.prompt.slice(0, 60)}`,
  );
  assert.ok(brief.prompt.includes('in Uganda'));
});

test('the category intent stays out of the prompt and lives in the judging note', () => {
  // "could carry a full-bleed page header" describes the slot, not the scene —
  // a generator would try to draw it.
  const brief = buildBrief(uganda.byCategory.hero, uganda);
  assert.ok(!brief.prompt.includes('full-bleed'), 'slot description leaked into the prompt');
  assert.ok(!brief.prompt.includes('page header'));
  assert.equal(brief.intent, getCategory('hero').intent);
});

test('each country carries its own look, so the 405 do not read as one place', () => {
  const looks = new Set(
    ALL_DESTINATIONS.map((d) => buildBrief(d.byCategory.nature, d).prompt),
  );
  assert.equal(looks.size, ALL_DESTINATIONS.length, 'two countries share a prompt');

  assert.match(buildBrief(uganda.byCategory.nature, uganda).prompt, /murram|equatorial green/);
  const djibouti = getDestination('djibouti');
  assert.match(buildBrief(djibouti.byCategory.nature, djibouti).prompt, /salt-white|basalt/);
});

test('demonyms are correct, not name-plus-n', () => {
  const cases = {
    somalia: 'Somali',
    comoros: 'Comorian',
    madagascar: 'Malagasy',
    seychelles: 'Seychellois',
    'south-sudan': 'South Sudanese',
  };
  for (const [slug, expected] of Object.entries(cases)) {
    const destination = getDestination(slug);
    const brief = buildBrief(destination.byCategory.people, destination);
    assert.ok(
      brief.composition.includes(`${expected} cultural detail`),
      `${slug}: expected "${expected}", got: ${brief.composition.slice(0, 80)}`,
    );
  }
  // The broken form these replace.
  for (const destination of ALL_DESTINATIONS) {
    const brief = buildBrief(destination.byCategory.people, destination);
    assert.ok(!/Comorosn|Madagascarn|Somalian|Seychellesn/.test(brief.composition));
  }
});

test('people categories carry authenticity direction, landscape ones do not', () => {
  const people = buildBrief(uganda.byCategory.people, uganda);
  assert.match(people.composition, /dignity and agency/);
  assert.match(people.composition, /not generic\s+pan-African/);

  const mountains = buildBrief(uganda.byCategory.mountains, uganda);
  assert.ok(!mountains.composition.includes('dignity and agency'));
});

test('wildlife and safari briefs forbid captive animals in both directions', () => {
  const brief = buildBrief(uganda.byCategory.wildlife, uganda);
  assert.match(brief.composition, /genuinely wild/);
  assert.ok(brief.negativePrompt.includes('zoo enclosure'));
  assert.ok(brief.negativePrompt.includes('captive animal'));
});

test('the negative prompt blocks text, watermarks and synthetic tells everywhere', () => {
  for (const destination of ALL_DESTINATIONS) {
    for (const brief of briefsFor(destination)) {
      for (const term of ['text', 'watermark', 'logo', 'deformed hands', '3d render', 'illustration']) {
        assert.ok(
          brief.negativePrompt.includes(term),
          `${destination.slug}/${brief.category} negative prompt missing "${term}"`,
        );
      }
    }
  }
});

test('aspect ratio and minimum width follow the render role, not the category', () => {
  const hero = buildBrief(uganda.byCategory.hero, uganda);
  assert.equal(hero.aspectRatio, '21:9');
  assert.equal(hero.minimumWidth, 2400);
  assert.match(hero.composition, /lower-left third/, 'hero must reserve space for the headline');

  const portrait = buildBrief(uganda.byCategory.people, uganda);
  assert.equal(portrait.aspectRatio, '3:4');

  const card = buildBrief(uganda.byCategory.food, uganda);
  assert.equal(card.aspectRatio, '4:3');
  assert.equal(roleOf(getCategory('food')).id, 'card');
});

test('the brief inherits the slot focal point, so the generated frame matches the crop', () => {
  const brief = buildBrief(uganda.byCategory.hero, uganda);
  assert.deepEqual(brief.focalPoint, { x: 66, y: 46 });
});

test('the region brief says East Africa rather than naming it as a country', () => {
  const region = getDestination('east-africa');
  const brief = buildBrief(region.byCategory.hero, region);
  assert.ok(brief.prompt.includes('in East Africa'));
});

test('text output is paste-ready and carries both prompts', () => {
  const text = briefToText(buildBrief(uganda.byCategory.wildlife, uganda));
  assert.match(text, /## 03 — Wildlife/);
  assert.match(text, /uganda\/wildlife/);
  assert.match(text, /\*\*Prompt\*\*/);
  assert.match(text, /\*\*Negative prompt\*\*/);
  assert.equal((text.match(/```/g) ?? []).length, 4, 'both prompts should be fenced');
});

test('the house style is shared, so the collection reads as one commission', () => {
  assert.ok(__test__.STYLE.length >= 4);
  for (const destination of ALL_DESTINATIONS.slice(0, 4)) {
    for (const brief of briefsFor(destination).slice(0, 3)) {
      assert.ok(brief.prompt.includes('documentary travel photography'));
      assert.ok(brief.prompt.includes('natural available light'));
    }
  }
});
