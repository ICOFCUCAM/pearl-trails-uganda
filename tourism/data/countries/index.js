/**
 * The East Africa country register.
 *
 * The existing site is a Uganda ground operator, so Uganda is the reference
 * implementation and is flagged `isHome`. The remaining thirteen countries are
 * the site's East Africa definition; `east-africa` is the regional overview and
 * is kept out of COUNTRIES so it never inflates per-country counts.
 *
 * Countries outside this register (Cameroon, for instance) are deliberately
 * absent — the site's regional classification is East Africa and nothing else.
 */

import uganda from './uganda.js';
import kenya from './kenya.js';
import tanzania from './tanzania.js';
import rwanda from './rwanda.js';
import burundi from './burundi.js';
import southSudan from './south-sudan.js';
import ethiopia from './ethiopia.js';
import somalia from './somalia.js';
import djibouti from './djibouti.js';
import eritrea from './eritrea.js';
import comoros from './comoros.js';
import seychelles from './seychelles.js';
import mauritius from './mauritius.js';
import madagascar from './madagascar.js';
import eastAfrica from './east-africa.js';

/** The fourteen countries, in the order they appear in the explorer. */
export const COUNTRIES = [
  uganda,
  kenya,
  tanzania,
  rwanda,
  burundi,
  southSudan,
  ethiopia,
  somalia,
  djibouti,
  eritrea,
  comoros,
  seychelles,
  mauritius,
  madagascar,
];

/** The regional overview record. */
export const REGION = eastAfrica;

/** Everything the resolver walks: countries plus the regional overview. */
export const ALL_DESTINATIONS = [...COUNTRIES, REGION];

export const COUNTRY_SLUGS = COUNTRIES.map((c) => c.slug);
export const ALL_SLUGS = ALL_DESTINATIONS.map((c) => c.slug);

const BY_SLUG = new Map(ALL_DESTINATIONS.map((c) => [c.slug, c]));

/** @param {string} slug */
export function getDestination(slug) {
  const found = BY_SLUG.get(String(slug).toLowerCase());
  if (!found) {
    throw new Error(
      `Unknown destination "${slug}". Known: ${ALL_SLUGS.join(', ')}`,
    );
  }
  return found;
}

/** True when the slug names a destination this site covers. */
export function hasDestination(slug) {
  return BY_SLUG.has(String(slug).toLowerCase());
}
