/**
 * The 27 tourism image categories.
 *
 * One record per category, shared by every country. A category carries the
 * things that do NOT vary by country: the render role (which decides crop,
 * aspect ratio and the width ladder the CDN is asked for), the orientation the
 * ranker should prefer, and the sentence frame used to compose a description
 * from the country's authored subject line.
 *
 * Everything country-specific — caption, subject, search query — lives in
 * tourism/data/countries/*.js. That split is what lets COUNTRY x 27 work
 * without a component per country.
 */

/**
 * Render roles. `aspect` is width/height. `widths` is the ladder handed to the
 * provider CDN so a card never downloads a hero-sized file. `sizes` is the
 * matching HTML `sizes` attribute.
 */
export const ROLES = {
  hero: {
    id: 'hero',
    aspect: 21 / 9,
    ratio: '21 / 9',
    // Below 900px the hero switches to a taller crop so the subject survives
    // a narrow viewport instead of being sliced into a letterbox.
    mobileRatio: '4 / 5',
    widths: [960, 1440, 1920, 2400],
    sizes: '100vw',
    orientation: 'landscape',
    eager: true,
  },
  parallax: {
    id: 'parallax',
    aspect: 16 / 9,
    ratio: '16 / 9',
    mobileRatio: '3 / 4',
    widths: [1200, 1600, 2000],
    sizes: '100vw',
    orientation: 'landscape',
    eager: false,
  },
  feature: {
    id: 'feature',
    aspect: 16 / 9,
    ratio: '16 / 9',
    mobileRatio: '3 / 2',
    widths: [640, 960, 1280, 1600],
    sizes: '(max-width: 900px) 100vw, 58vw',
    orientation: 'landscape',
    eager: false,
  },
  card: {
    id: 'card',
    aspect: 4 / 3,
    ratio: '4 / 3',
    mobileRatio: '4 / 3',
    widths: [400, 600, 800],
    sizes: '(max-width: 520px) 100vw, (max-width: 920px) 50vw, 25vw',
    orientation: 'landscape',
    eager: false,
  },
  portrait: {
    id: 'portrait',
    aspect: 3 / 4,
    ratio: '3 / 4',
    mobileRatio: '3 / 4',
    widths: [400, 600, 900],
    sizes: '(max-width: 520px) 100vw, (max-width: 920px) 50vw, 25vw',
    orientation: 'portrait',
    eager: false,
  },
};

/** @type {ReadonlyArray<import('./types.js').Category>} */
export const CATEGORIES = [
  {
    no: '01',
    id: 'hero',
    title: 'Hero Destination',
    role: 'hero',
    frame: (country, subject) => `The opening frame for ${country}: ${subject}.`,
    intent: 'A wide, cinematic establishing shot that could carry a full-bleed page header.',
  },
  {
    no: '02',
    id: 'nature',
    title: 'Nature & Landscapes',
    role: 'parallax',
    frame: (country, subject) => `${country}'s landscape at its most open — ${subject}.`,
    intent: 'Expansive natural scenery with depth and a clear horizon.',
  },
  {
    no: '03',
    id: 'wildlife',
    title: 'Wildlife',
    role: 'feature',
    frame: (country, subject) => `Wildlife in ${country}: ${subject}.`,
    intent: 'A recognisable wild animal in its habitat, not a zoo enclosure.',
  },
  {
    no: '04',
    id: 'safari',
    title: 'Safari',
    role: 'feature',
    frame: (country, subject) => `On safari in ${country} — ${subject}.`,
    intent: 'The act of going out to look: vehicles, tracks, guides, plains at first light.',
  },
  {
    no: '05',
    id: 'mountains',
    title: 'Mountains',
    role: 'parallax',
    frame: (country, subject) => `High ground in ${country} — ${subject}.`,
    intent: 'Relief, altitude and weather. Ridge lines rather than a single summit snapshot.',
  },
  {
    no: '06',
    id: 'waterfalls',
    title: 'Waterfalls',
    role: 'portrait',
    frame: (country, subject) => `Falling water in ${country}: ${subject}.`,
    intent: 'Vertical drop, spray and the rock it cuts through.',
  },
  {
    no: '07',
    id: 'lakes',
    title: 'Lakes & Rivers',
    role: 'feature',
    frame: (country, subject) => `Inland water in ${country} — ${subject}.`,
    intent: 'Freshwater: shorelines, channels, boats, the light coming off the surface.',
  },
  {
    no: '08',
    id: 'beaches',
    title: 'Beaches & Coast',
    role: 'feature',
    frame: (country, subject) => `Where ${country} meets the water — ${subject}.`,
    intent: "The country's own waterfront, whether ocean coast or a great lake shore.",
  },
  {
    no: '09',
    id: 'forests',
    title: 'Forests & Rainforest',
    role: 'portrait',
    frame: (country, subject) => `Under canopy in ${country}: ${subject}.`,
    intent: 'Closed canopy, understorey, light falling through leaves.',
  },
  {
    no: '10',
    id: 'adventure',
    title: 'Adventure',
    role: 'card',
    frame: (country, subject) => `Adventure in ${country} — ${subject}.`,
    intent: 'People doing something physical and committing: water, rope, altitude, distance.',
  },
  {
    no: '11',
    id: 'culture',
    title: 'Culture',
    role: 'feature',
    frame: (country, subject) => `Cultural life in ${country}: ${subject}.`,
    intent: 'Living culture in its own setting — music, dress, ceremony, craft in use.',
  },
  {
    no: '12',
    id: 'people',
    title: 'People & Tradition',
    role: 'portrait',
    frame: (country, subject) => `The people of ${country} — ${subject}.`,
    intent: 'Portraiture with dignity. Named traditions, not interchangeable stock faces.',
  },
  {
    no: '13',
    id: 'food',
    title: 'Food & Cuisine',
    role: 'card',
    frame: (country, subject) => `Eating in ${country}: ${subject}.`,
    intent: 'The country\'s own dishes and the places they are cooked and sold.',
  },
  {
    no: '14',
    id: 'festivals',
    title: 'Festivals & Celebrations',
    role: 'card',
    frame: (country, subject) => `Celebration in ${country} — ${subject}.`,
    intent: 'Gathering, movement, colour: a crowd doing something together.',
  },
  {
    no: '15',
    id: 'crafts',
    title: 'Arts & Crafts',
    role: 'card',
    frame: (country, subject) => `Made in ${country}: ${subject}.`,
    intent: 'Hands, tools and finished work — weaving, carving, dyeing, beadwork.',
  },
  {
    no: '16',
    id: 'historic',
    title: 'Historic Sites',
    role: 'card',
    frame: (country, subject) => `Standing history in ${country} — ${subject}.`,
    intent: 'A specific dated site, ruin or monument that a visitor can walk into.',
  },
  {
    no: '17',
    id: 'heritage',
    title: 'Heritage',
    role: 'card',
    frame: (country, subject) => `Inherited ${country} — ${subject}.`,
    intent: 'What is kept and handed on: sacred sites, archives, protected quarters.',
  },
  {
    no: '18',
    id: 'cities',
    title: 'Cities',
    role: 'feature',
    frame: (country, subject) => `Urban ${country}: ${subject}.`,
    intent: 'A real skyline or street grid that reads as this city and no other.',
  },
  {
    no: '19',
    id: 'architecture',
    title: 'Architecture',
    role: 'portrait',
    frame: (country, subject) => `Built ${country} — ${subject}.`,
    intent: 'Form, facade and material at close range.',
  },
  {
    no: '20',
    id: 'locallife',
    title: 'Local Life',
    role: 'card',
    frame: (country, subject) => `An ordinary day in ${country}: ${subject}.`,
    intent: 'Markets, transport, trade, the street at working hours.',
  },
  {
    no: '21',
    id: 'family',
    title: 'Family & Community',
    role: 'card',
    frame: (country, subject) => `Together in ${country} — ${subject}.`,
    intent: 'Households and neighbourhoods: shared work, shared meals, children at play.',
  },
  {
    no: '22',
    id: 'outdoors',
    title: 'Outdoor Experiences',
    role: 'card',
    frame: (country, subject) => `Outdoors in ${country}: ${subject}.`,
    intent: 'Walking, paddling, riding, camping — unhurried time outside.',
  },
  {
    no: '23',
    id: 'luxury',
    title: 'Luxury Travel',
    role: 'feature',
    frame: (country, subject) => `The considered end of ${country} — ${subject}.`,
    intent: 'Restraint and setting rather than gold taps: a lodge deck with a view earned.',
  },
  {
    no: '24',
    id: 'ecotourism',
    title: 'Eco Tourism',
    role: 'card',
    frame: (country, subject) => `Low-impact ${country} — ${subject}.`,
    intent: 'Conservation at work: rangers, reforestation, community-run tourism.',
  },
  {
    no: '25',
    id: 'scenic',
    title: 'Scenic Views',
    role: 'parallax',
    frame: (country, subject) => `The long view over ${country}: ${subject}.`,
    intent: 'A viewpoint photograph — great depth, layered distance, room for text.',
  },
  {
    no: '26',
    id: 'hiddengems',
    title: 'Hidden Gems',
    role: 'card',
    frame: (country, subject) => `Off the usual line in ${country} — ${subject}.`,
    intent: 'The place that is not on the poster but rewards the detour.',
  },
  {
    no: '27',
    id: 'whyvisit',
    title: 'Why Visit',
    role: 'parallax',
    frame: (country, subject) => `Why travellers come to ${country}: ${subject}.`,
    intent: 'The closing argument — one image that answers "why here".',
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** @param {string} id */
export function getCategory(id) {
  const category = BY_ID.get(id);
  if (!category) throw new Error(`Unknown tourism category: ${id}`);
  return category;
}

/** @param {string} id */
export function getRole(id) {
  const role = ROLES[id];
  if (!role) throw new Error(`Unknown render role: ${id}`);
  return role;
}

/** The render role record for a category. */
export function roleOf(category) {
  return getRole(category.role);
}
