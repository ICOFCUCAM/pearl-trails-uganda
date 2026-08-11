/**
 * Country definition helpers.
 *
 * A country file declares four things and nothing else:
 *
 *   identity   — name, slug, tagline, the page's own copy
 *   signature  — place names that belong to this country and no other. These
 *                are the terms the ranker rewards, and — crucially — every
 *                OTHER country's signature terms become this country's
 *                negative terms automatically (see lib/ranking.js). That is
 *                what stops "Uganda + Beaches" resolving to Zanzibar.
 *   strong     — broader terms that support a country match without being
 *                exclusive to it (people, language, adjective forms).
 *   entries    — one authored record per category id.
 *
 * Everything else (description, alt text, focal point defaults, CDN widths) is
 * derived, so a new country is one data file and no new components.
 */

import { CATEGORIES, CATEGORY_IDS, getCategory, roleOf } from '../categories.js';

/**
 * Author one category entry.
 *
 * @param {string} caption  Premium marketing headline. Country-specific, never
 *                          the raw category name.
 * @param {string} subject  The concrete photographic subject, written as a noun
 *                          phrase that reads correctly inside an alt sentence.
 *                          e.g. "a mountain gorilla resting in the Bwindi
 *                          rainforest" -> alt "Mountain gorilla resting in the
 *                          Bwindi rainforest, Uganda".
 * @param {string} query    Provider search query. Front-load the country and
 *                          the named place; providers weight leading terms.
 * @param {{focalPoint?: {x: number, y: number}}} [opts]
 */
export function e(caption, subject, query, opts = {}) {
  return { caption, subject, query, ...opts };
}

/** Sentence-case a subject phrase for use as alt text. */
function toAlt(subject, countryName) {
  const trimmed = subject.replace(/^(a|an|the)\s+/i, '');
  const sentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${sentence}, ${countryName}`;
}

/**
 * Default focal point. Heroes and parallax bands carry their copy on the left
 * or in a central beam, so the default pulls the subject slightly above centre
 * and off the text side rather than dead-centring every crop.
 */
function defaultFocalPoint(role) {
  switch (role.id) {
    case 'hero':
      return { x: 62, y: 44 };
    case 'parallax':
      return { x: 58, y: 42 };
    case 'portrait':
      return { x: 50, y: 38 };
    default:
      return { x: 50, y: 45 };
  }
}

/**
 * Expand an authored country file into the full per-category record set.
 * Throws if a category is missing, so an incomplete country cannot ship.
 */
export function defineCountry(input) {
  const missing = CATEGORY_IDS.filter((id) => !input.entries[id]);
  if (missing.length) {
    throw new Error(
      `${input.name}: missing tourism categories -> ${missing.join(', ')}`,
    );
  }
  const unknown = Object.keys(input.entries).filter(
    (id) => !CATEGORY_IDS.includes(id),
  );
  if (unknown.length) {
    throw new Error(`${input.name}: unknown categories -> ${unknown.join(', ')}`);
  }

  const categories = CATEGORIES.map((category) => {
    const authored = input.entries[category.id];
    const role = roleOf(category);
    return {
      country: input.slug,
      countryName: input.name,
      category: category.id,
      categoryTitle: category.title,
      no: category.no,
      role: role.id,
      caption: authored.caption,
      subject: authored.subject,
      description: category.frame(input.name, authored.subject),
      alt: toAlt(authored.subject, input.name),
      searchQuery: authored.query,
      focalPoint: authored.focalPoint ?? defaultFocalPoint(role),
      intent: category.intent,
    };
  });

  return {
    ...input,
    categories,
    byCategory: Object.fromEntries(categories.map((c) => [c.category, c])),
  };
}

export { getCategory };
