/**
 * The art-direction engine.
 *
 * Every one of the 405 slots already carries the three things a brief needs:
 * a country identity with its own signature places, a category with a stated
 * photographic intent, and an authored subject line. This module composes them
 * into a generation brief — positive prompt, negative prompt, aspect ratio and
 * composition notes — so a reference image can be produced for each slot and
 * held up against the Unsplash and Pexels candidates.
 *
 * Nothing here calls an image model. It emits instructions; you run them
 * through whichever generator you use. That separation is deliberate: the
 * briefs are reviewable and diffable on their own, and swapping generators
 * costs nothing.
 *
 * A generated image is a REFERENCE by default — the shot you are trying to
 * find, used to judge candidates. See tourism/generated/README.md for what has
 * to be true before one is allowed onto the site itself.
 */

import { getCategory, roleOf } from '../data/categories.js';

/**
 * Per-country look. The country data files carry facts — places, culture,
 * subjects. This carries the photographic character: the light, the palette,
 * the texture of the place. Kept here rather than in the country files so the
 * data stays about the country and not about how to photograph it.
 */
const LOOK = {
  uganda:
    'equatorial green under high cloud, red murram earth, mist sitting in forested valleys, ' +
    'soft diffused light rather than hard sun',
  kenya:
    'golden savannah light, long low sun, acacia silhouettes, dust in the air, ' +
    'deep blue sky with towering cumulus',
  tanzania:
    'vast open plains and volcanic relief, warm dust-toned light inland, ' +
    'bright turquoise and white on the coast',
  rwanda:
    'terraced hills receding in layers of blue haze, soft wet-season light, ' +
    'intense cultivated green, volcanoes half in cloud',
  burundi:
    'green ridges dropping to a huge pale lake, hazy afternoon light, ' +
    'wide quiet horizons',
  'south-sudan':
    'enormous flat sky over floodplain and papyrus, dust and woodsmoke in the light, ' +
    'long low sun, ochre and ash tones',
  ethiopia:
    'high-altitude clarity, sharp shadows, ochre rock and dark basalt, ' +
    'white cotton clothing against dark stone, thin cold air',
  somalia:
    'hard coastal light, bleached sand and limestone, deep Indian Ocean blue, ' +
    'dry scrub and open sky',
  djibouti:
    'salt-white and black basalt, mineral colour, shimmering heat, ' +
    'stark geological forms under a hard sun',
  eritrea:
    'clean highland light at altitude, pastel modernist facades, ' +
    'palm shade on wide avenues, warm Red Sea haze on the coast',
  comoros:
    'volcanic black rock against turquoise shallows, dense tropical green, ' +
    'humid island light, coconut palms',
  seychelles:
    'weathered pink-grey granite, luminous turquoise water, ' +
    'bright filtered light through palm and takamaka',
  mauritius:
    'flat lagoon turquoise inside a reef line, basalt peaks behind cane fields, ' +
    'clean tropical light',
  madagascar:
    'red laterite earth, enormous baobab silhouettes, dusty warm light, ' +
    'unusual endemic vegetation',
  'east-africa':
    'the Rift Valley in layered distance, huge sky, light ranging from ' +
    'equatorial green to savannah gold',
};

/** Composition direction per render role, including where copy will sit. */
const COMPOSITION = {
  hero: {
    aspect: '21:9',
    fallbackAspect: '16:9',
    note:
      'Ultra-wide establishing shot for a full-bleed page header. Place the subject ' +
      'right of centre and slightly above the midline. Leave the lower-left third ' +
      'open and uncluttered — a headline and paragraph sit there. Keep nothing ' +
      'important within 8% of any edge; the frame is re-cropped to 4:5 on mobile. ' +
      'Deep foreground-to-horizon depth.',
  },
  parallax: {
    aspect: '16:9',
    fallbackAspect: '16:9',
    note:
      'Wide scene that survives vertical cropping — the frame scrolls behind a ' +
      'fixed window, so the subject must sit in the middle band vertically. Copy ' +
      'sits on the left third over a dark scrim; keep that side simpler and darker.',
  },
  feature: {
    aspect: '16:9',
    fallbackAspect: '16:9',
    note:
      'Editorial feature image beside a column of text. A single clear subject, ' +
      'read at a glance, comfortable at half-page width.',
  },
  card: {
    aspect: '4:3',
    fallbackAspect: '4:3',
    note:
      'Small grid tile. One unmistakable subject, generous scale in frame, ' +
      'legible at roughly 380px wide. No fine detail that dies at that size.',
  },
  portrait: {
    aspect: '3:4',
    fallbackAspect: '3:4',
    note:
      'Vertical frame. Subject centred horizontally, weighted slightly above ' +
      'centre. Works as a tall tile in a four-column grid.',
  },
};

/** The house style. Shared by every brief so the 405 read as one collection. */
const STYLE = [
  'authentic documentary travel photography',
  'natural available light',
  'full-frame camera, 35mm or 50mm lens',
  'realistic colour grading, not oversaturated',
  'photojournalistic, unposed, candid',
  'high dynamic range in the real sense: detail held in both highlight and shadow',
];

/** What must never appear. Kept in one place so it cannot drift per country. */
const NEGATIVE = [
  // provenance and surface
  'text', 'lettering', 'captions', 'watermark', 'logo', 'signature', 'border', 'frame',
  'collage', 'split screen',
  // the stock-library tells the ranker also penalises
  'studio background', 'isolated on white', 'copy space graphic', 'stock photo staging',
  'obviously posed models', 'fake smiling to camera',
  // rendering failure modes
  'illustration', 'painting', 'cartoon', '3d render', 'CGI', 'video game', 'anime',
  'plastic skin', 'waxy skin', 'deformed hands', 'extra fingers', 'extra limbs',
  'distorted faces', 'asymmetrical eyes',
  'oversaturated HDR', 'heavy vignette', 'blurry', 'low resolution', 'jpeg artifacts',
  // subject-matter failures
  'zoo enclosure', 'fence', 'cage', 'safari park', 'captive animal',
  'modern tourist crowds with phones', 'anachronistic clothing',
];

/**
 * Categories depicting people carry an extra instruction. "Do not make every
 * African person look interchangeable" is the requirement; the way to meet it
 * in a prompt is to name the specific culture and let the country's own
 * signature terms do the work, rather than asking for "African people".
 */
const PEOPLE_CATEGORIES = new Set([
  'people', 'culture', 'family', 'locallife', 'festivals', 'crafts', 'food',
]);

function peopleGuidance(destination) {
  return (
    `Depict specifically ${demonym(destination)} cultural detail — dress, textile, ` +
    'ornament, setting and activity particular to this country, not generic ' +
    'pan-African imagery. People shown with dignity and agency, absorbed in what ' +
    'they are doing rather than presenting to the camera. Real working clothes ' +
    'and real wear. Mixed ages. No poverty-tourism framing, no white saviour ' +
    'framing, no ceremonial dress presented as everyday wear.'
  );
}

/** Grammatically forgiving demonym — used only inside prompt prose. */
function demonym(destination) {
  const map = {
    uganda: 'Ugandan', kenya: 'Kenyan', tanzania: 'Tanzanian', rwanda: 'Rwandan',
    burundi: 'Burundian', 'south-sudan': 'South Sudanese', ethiopia: 'Ethiopian',
    somalia: 'Somali', djibouti: 'Djiboutian', eritrea: 'Eritrean',
    comoros: 'Comorian', seychelles: 'Seychellois', mauritius: 'Mauritian',
    madagascar: 'Malagasy', 'east-africa': 'East African',
  };
  return map[destination.slug] ?? destination.name;
}

/**
 * Build the full brief for one slot.
 *
 * @param {object} entry        expanded category entry
 * @param {object} destination  the country record
 * @returns {object} the brief
 */
export function buildBrief(entry, destination) {
  const category = getCategory(entry.category);
  const role = roleOf(category);
  const composition = COMPOSITION[role.id];
  const look = LOOK[destination.slug] ?? '';
  const isPeople = PEOPLE_CATEGORIES.has(entry.category);

  // Front-load the subject: generators weight leading tokens most heavily.
  // The category intent deliberately stays OUT of the positive prompt — it is
  // a description of the slot ("could carry a full-bleed header"), not of the
  // scene, and generators treat every clause as something to draw. It belongs
  // in the composition note and in the judging criterion instead.
  const positive = [
    entry.subject.replace(/^(a|an|the)\s+/i, ''),
    destination.isRegion ? 'in East Africa' : `in ${destination.name}`,
    look,
    ...STYLE,
  ]
    .filter(Boolean)
    .join(', ');

  const direction = [composition.note];
  if (isPeople) direction.push(peopleGuidance(destination));
  if (['wildlife', 'safari'].includes(entry.category)) {
    direction.push(
      'The animal must be genuinely wild and in its own habitat — no enclosure, ' +
        'no fence line, no habituated-to-humans posing.',
    );
  }

  return {
    country: destination.slug,
    countryName: destination.name,
    category: entry.category,
    categoryTitle: entry.categoryTitle,
    no: entry.no,
    role: role.id,

    // what the slot is for
    caption: entry.caption,
    alt: entry.alt,
    intent: category.intent,

    // the brief proper
    prompt: positive,
    negativePrompt: NEGATIVE.join(', '),
    aspectRatio: composition.aspect,
    fallbackAspectRatio: composition.fallbackAspect,
    composition: direction.join(' '),
    focalPoint: entry.focalPoint,

    // provenance for whatever the generator produces
    referenceFor: `${destination.slug}/${entry.category}`,
    searchQuery: entry.searchQuery,
    minimumWidth: role.id === 'hero' ? 2400 : role.widths[role.widths.length - 1],
  };
}

/** Every brief for a destination. */
export function briefsFor(destination) {
  return destination.categories.map((entry) => buildBrief(entry, destination));
}

/** Render one brief as paste-ready text for a generator UI. */
export function briefToText(brief) {
  return [
    `## ${brief.no} — ${brief.categoryTitle}`,
    `**Slot:** \`${brief.referenceFor}\`  ·  **Caption:** ${brief.caption}`,
    '',
    '**Prompt**',
    '```',
    brief.prompt,
    '```',
    '',
    '**Negative prompt**',
    '```',
    brief.negativePrompt,
    '```',
    '',
    `**Aspect ratio:** ${brief.aspectRatio}  ·  **Minimum width:** ${brief.minimumWidth}px  ·  ` +
      `**Focal point:** ${brief.focalPoint.x}% ${brief.focalPoint.y}%`,
    '',
    `**Composition:** ${brief.composition}`,
    '',
    `**Judging the stock candidates against this:** ${brief.intent}`,
    '',
  ].join('\n');
}

export const __test__ = { LOOK, NEGATIVE, COMPOSITION, STYLE, demonym };
