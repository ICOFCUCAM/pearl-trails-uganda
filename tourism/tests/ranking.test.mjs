import test from 'node:test';
import assert from 'node:assert/strict';

import { rankCandidates, scoreCandidate, ACCEPT_THRESHOLD, __test__ } from '../lib/ranking.js';
import { getDestination } from '../data/countries/index.js';

const uganda = getDestination('uganda');
const kenya = getDestination('kenya');

function candidate(overrides = {}) {
  return {
    provider: 'unsplash',
    photoId: 'x1',
    baseUrl: 'https://images.unsplash.com/photo-x1',
    sourceUrl: 'https://unsplash.com/photos/x1',
    photographer: 'P',
    photographerUrl: 'https://unsplash.com/@p',
    width: 4000,
    height: 2600,
    description: '',
    tags: [],
    likes: 100,
    ...overrides,
  };
}

test('another country\'s signature landmark is disqualifying', () => {
  const entry = uganda.byCategory.beaches;
  const zanzibar = candidate({
    description: 'White sand beach in Zanzibar, Tanzania',
    tags: ['zanzibar', 'beach'],
  });
  const { total, parts } = scoreCandidate(zanzibar, entry, uganda);
  assert.equal(parts.conflict, -40);
  assert.ok(total < ACCEPT_THRESHOLD, `expected rejection, scored ${total}`);
});

test('Uganda + Beaches prefers Lake Victoria over an Indian Ocean beach', () => {
  const entry = uganda.byCategory.beaches;
  const ssese = candidate({
    photoId: 'ssese',
    description: 'Shoreline of the Ssese Islands on Lake Victoria, Uganda',
    tags: ['uganda', 'lake victoria', 'ssese', 'beach', 'shoreline'],
  });
  const generic = candidate({
    photoId: 'zanzibar',
    description: 'Tropical white sand beach in Zanzibar',
    tags: ['zanzibar', 'beach', 'tropical'],
  });

  const { best } = rankCandidates([generic, ssese], entry, uganda);
  assert.ok(best, 'a Ugandan waterfront should be acceptable');
  assert.equal(best.candidate.photoId, 'ssese');
});

test('Uganda + Culture prefers Ugandan cultural imagery', () => {
  const entry = uganda.byCategory.culture;
  const buganda = candidate({
    photoId: 'buganda',
    description: 'Buganda traditional dancers and drummers in Uganda',
    tags: ['uganda', 'buganda', 'dance', 'drums', 'culture'],
  });
  const maasai = candidate({
    photoId: 'maasai',
    description: 'Maasai warriors dancing in the Maasai Mara, Kenya',
    tags: ['kenya', 'maasai mara', 'culture', 'dance'],
  });

  const { best } = rankCandidates([maasai, buganda], entry, uganda);
  assert.equal(best.candidate.photoId, 'buganda');
});

test('the same landmark is welcome for the country that owns it', () => {
  const entry = kenya.byCategory.culture;
  const maasai = candidate({
    description: 'Maasai warriors performing the adumu in the Maasai Mara, Kenya',
    tags: ['kenya', 'maasai mara', 'culture', 'dance', 'maasai'],
  });
  const { parts, total } = scoreCandidate(maasai, entry, kenya);
  assert.equal(parts.conflict, 0);
  assert.ok(total >= ACCEPT_THRESHOLD, `expected acceptance, scored ${total}`);
});

test('a zoo photograph loses to a wild one for the wildlife category', () => {
  const entry = uganda.byCategory.wildlife;
  const wild = candidate({
    photoId: 'wild',
    description: 'Mountain gorilla in the Bwindi rainforest, Uganda',
    tags: ['uganda', 'bwindi', 'gorilla', 'wildlife', 'rainforest'],
  });
  const zoo = candidate({
    photoId: 'zoo',
    description: 'Gorilla in a zoo enclosure in Uganda, Bwindi exhibit',
    tags: ['uganda', 'gorilla', 'zoo', 'captive'],
  });
  const wildScore = scoreCandidate(wild, entry, uganda).total;
  const zooScore = scoreCandidate(zoo, entry, uganda).total;
  assert.ok(wildScore > zooScore, `${wildScore} should beat ${zooScore}`);
});

test('studio and stock-concept imagery is penalised', () => {
  const entry = uganda.byCategory.food;
  const staged = candidate({
    description: 'Ugandan food isolated on white background, studio shot with copy space',
    tags: ['uganda', 'food'],
  });
  assert.ok(scoreCandidate(staged, entry, uganda).parts.authenticity < 0);
});

test('a hero candidate that is too small or too square is penalised', () => {
  const entry = uganda.byCategory.hero;
  const wide = candidate({ width: 5000, height: 2400 });
  const small = candidate({ width: 1200, height: 1100 });
  assert.ok(
    scoreCandidate(wide, entry, uganda).parts.shape >
      scoreCandidate(small, entry, uganda).parts.shape,
  );
});

test('an already-used photograph is never chosen again', () => {
  const entry = uganda.byCategory.wildlife;
  const only = candidate({
    photoId: 'dup',
    description: 'Mountain gorilla in the Bwindi rainforest, Uganda',
    tags: ['uganda', 'bwindi', 'gorilla', 'wildlife'],
  });
  const used = new Set(['unsplash:dup']);
  const { best } = rankCandidates([only], entry, uganda, used);
  assert.equal(best, null, 'a duplicate must not be accepted');
});

test('nothing acceptable returns null rather than the least-bad option', () => {
  const entry = uganda.byCategory.wildlife;
  const irrelevant = candidate({
    width: 900,
    height: 900,
    likes: 0,
    description: 'A parked car',
    tags: ['car'],
  });
  const { best } = rankCandidates([irrelevant], entry, uganda);
  assert.equal(best, null);
});

test('conflict terms exclude the country\'s own signature places', () => {
  const terms = __test__.conflictTermsFor('uganda');
  assert.ok(!terms.includes('bwindi'));
  assert.ok(terms.includes('serengeti'));
  assert.ok(terms.includes('maasai mara'));
});
