/**
 * The authenticity policy.
 *
 * Afrinkong's rule: REAL PHOTOGRAPHY FOR REAL PLACES AND PEOPLE. Synthetic
 * imagery exists only for visuals that are clearly illustrative, and a visitor
 * must always be able to tell which is which.
 *
 * This module is the single place that decides. Everything downstream — the
 * resolver, the audit, the review sheet, the renderer — asks it rather than
 * carrying its own copy of the rule, so the policy cannot drift between the
 * thing that enforces it and the thing that displays it.
 *
 * Permission is never inferred. A slot is real-photography-only unless it
 * passes every gate below, and the gates are deliberately hard to pass.
 */

import { CATEGORY_IDS, getCategory } from './categories.js';

/**
 * The allowlist. Three categories, and only these three.
 *
 * They are the site's atmospheric bands — the parallax panels and conceptual
 * transitions that carry mood rather than evidence. Every other category is
 * documentary content about a real place or real people.
 *
 *   hero      conceptual opening transitions (region only — see below)
 *   scenic    non-specific scenic backgrounds, generic environmental mood
 *   whyvisit  editorial illustration, clearly presented as illustrative
 *
 * Adding to this list is a policy decision, not a technical one. Do it here,
 * in the open, or not at all.
 */
export const SYNTHETIC_ALLOWED_CATEGORIES = Object.freeze([
  'hero',
  'scenic',
  'whyvisit',
]);

/**
 * Real-photography-only, stated explicitly rather than derived, so the
 * protection is legible in the diff when someone edits the allowlist. A test
 * asserts these never appear in SYNTHETIC_ALLOWED_CATEGORIES.
 *
 * These are the categories whose images a visitor would reasonably read as
 * documentary evidence of a real place or real people.
 */
export const REAL_ONLY_CATEGORIES = Object.freeze([
  // people and cultural life — the sharpest case
  'people', 'culture', 'family', 'locallife', 'festivals', 'crafts', 'food',
  // animals, presented as observed
  'wildlife', 'safari',
  // the built and inherited environment
  'heritage', 'historic', 'cities', 'architecture',
  // named natural features: specific mountain, waterfall, lake, beach, island
  'mountains', 'waterfalls', 'lakes', 'beaches', 'forests', 'nature',
  // experiences sold as things that happen in a real place
  'adventure', 'outdoors', 'luxury', 'ecotourism', 'hiddengems',
]);

/** The fixed text shown wherever a synthetic image appears. */
export const VISUAL_DISCLOSURE =
  'Illustrative image — not a photograph of the destination.';

/**
 * Provider preference. Real photography first, always; synthetic is a
 * fallback, never a competitor. The resolver walks this in order and stops at
 * the first provider that yields an acceptable image, so a valid Unsplash or
 * Pexels photograph is preferred over a synthetic one even when the synthetic
 * one would score higher.
 */
export const PROVIDER_PREFERENCE = Object.freeze(['unsplash', 'pexels', 'synthetic']);

export const SYNTHETIC_PROVIDER = 'synthetic';
export const REAL_PROVIDERS = Object.freeze(['unsplash', 'pexels']);

export function isRealProvider(provider) {
  return REAL_PROVIDERS.includes(provider);
}

/**
 * Does this slot make a claim about a recognisable real place?
 *
 * The country data already names each destination's signature places, so a
 * subject line that mentions Bwindi, the Rwenzori or Lake Bunyonyi is asking
 * for a photograph OF somewhere. Generating that is exactly the deception the
 * policy exists to prevent, and it overrides the category allowlist:
 *
 *   "If the image depicts a recognizable real destination, default to real
 *    photography even if the category itself could otherwise be synthetic."
 */
export function namesSpecificPlace(entry, destination) {
  const haystack = [entry.subject, entry.searchQuery, entry.caption, entry.alt]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // A destination's own name is not a "specific location" in the sense the
  // policy means. Every search query leads with the country name by
  // construction, so counting it would refuse all 405 slots and make the
  // allowlist decorative. "Uganda" is a country; "Bwindi" is the place a
  // visitor would believe they were being shown. The country-level claim is
  // handled by the hero rule and by the category allowlist instead.
  const self = new Set(
    [
      destination.name,
      destination.slug.replace(/-/g, ' '),
      destination.tagline,
      // the tagline's terms as they appear in `strong` ("pearl of africa")
      ...(destination.strong ?? []).filter((term) =>
        String(destination.tagline ?? '').toLowerCase().includes(String(term).toLowerCase()),
      ),
      // demonyms: "ugandan", "kenyan", "somali" …
      ...(destination.signature ?? []).filter((term) => {
        const t = String(term).toLowerCase();
        const n = String(destination.name).toLowerCase();
        return t === n || (t.startsWith(n.slice(0, Math.max(4, n.length - 2))) && t.length <= n.length + 3);
      }),
    ]
      .filter(Boolean)
      .map((t) => String(t).toLowerCase()),
  );

  const terms = [...(destination.signature ?? []), ...(destination.strong ?? [])].filter(
    (term) => !self.has(String(term).toLowerCase()),
  );
  const hits = terms.filter((term) => {
    const needle = String(term).toLowerCase();
    // Word-boundary match so "jinja" does not fire on a substring, and
    // multi-word place names ("murchison falls") match as phrases.
    return new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(
      haystack,
    );
  });

  return hits;
}

/**
 * May this slot use a synthetic image?
 *
 * @returns {{allowed: boolean, reasons: string[]}} reasons are always
 *   populated on refusal, so the audit and the review sheet can say WHY
 *   rather than just no.
 */
export function syntheticEligibility(entry, destination) {
  const reasons = [];

  if (!SYNTHETIC_ALLOWED_CATEGORIES.includes(entry.category)) {
    reasons.push(
      `"${entry.category}" is not in SYNTHETIC_ALLOWED_CATEGORIES — ` +
        'real photography only',
    );
  }

  // The hero rule. A country hero IS a specific destination claim: it is the
  // opening frame of a page selling that country. Only the region-wide hero
  // can be a conceptual, non-specific interpretation.
  if (entry.category === 'hero' && !destination.isRegion) {
    reasons.push(
      `a hero for ${destination.name} depicts a specific destination — ` +
        'real photography required',
    );
  }

  // The override: a named place beats the allowlist.
  const places = namesSpecificPlace(entry, destination);
  if (places.length) {
    reasons.push(
      `names ${places.length === 1 ? 'a recognisable place' : 'recognisable places'} ` +
        `(${places.slice(0, 3).join(', ')}) — real photography required`,
    );
  }

  return { allowed: reasons.length === 0, reasons };
}

/** Every slot that could ever carry a synthetic image, across all destinations. */
export function eligibleSlots(destinations) {
  const slots = [];
  for (const destination of destinations) {
    for (const entry of destination.categories) {
      const { allowed, reasons } = syntheticEligibility(entry, destination);
      if (allowed) slots.push({ country: destination.slug, category: entry.category, reasons });
    }
  }
  return slots;
}

/** Sanity: the allowlist and the protected list must never intersect. */
export function policyConflicts() {
  const conflicts = SYNTHETIC_ALLOWED_CATEGORIES.filter((id) =>
    REAL_ONLY_CATEGORIES.includes(id),
  );
  const unknown = [...SYNTHETIC_ALLOWED_CATEGORIES, ...REAL_ONLY_CATEGORIES].filter(
    (id) => !CATEGORY_IDS.includes(id),
  );
  const uncovered = CATEGORY_IDS.filter(
    (id) =>
      !SYNTHETIC_ALLOWED_CATEGORIES.includes(id) && !REAL_ONLY_CATEGORIES.includes(id),
  );
  return { conflicts, unknown, uncovered };
}

/** Human-readable policy line for a category, used by the docs and review sheet. */
export function describePolicy(categoryId) {
  const category = getCategory(categoryId);
  return SYNTHETIC_ALLOWED_CATEGORIES.includes(categoryId)
    ? `${category.title}: synthetic permitted for non-specific visuals only`
    : `${category.title}: real photography only`;
}
