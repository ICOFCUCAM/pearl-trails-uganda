/**
 * The resolver.
 *
 *   country + category + tourism query
 *     -> Unsplash  -> rank -> validate -> cache -> manifest
 *     -> (nothing acceptable) -> Pexels -> rank -> validate -> cache -> manifest
 *     -> (still nothing) -> UNRESOLVED, with the reason recorded
 *
 * The last branch is the important one. There is no fallback that invents a
 * URL, guesses a photo id, or turns a page slug into a CDN path. An unresolved
 * record renders as a typographic plate and is reported by the audit.
 */

import * as unsplash from './providers/unsplash.js';
import * as pexels from './providers/pexels.js';
import { rankCandidates, ACCEPT_THRESHOLD } from './ranking.js';
import { assertProviderUrl, responsiveSet } from './cdn.js';
import { getCategory, roleOf } from '../data/categories.js';
import { readCache, writeCache, cacheKey } from './cache.js';
import * as synthetic from './providers/synthetic.js';
import { assertSyntheticSrc } from './providers/synthetic.js';
import {
  SYNTHETIC_PROVIDER,
  VISUAL_DISCLOSURE,
  syntheticEligibility,
} from '../data/synthetic-policy.js';

export const STATUS = {
  RESOLVED: 'resolved',
  UNRESOLVED: 'unresolved',
};

/**
 * Final structural check before a candidate becomes a record. Anything that
 * cannot produce a valid provider URL is rejected here, so a malformed
 * response can never reach the manifest.
 */
export function validateCandidate(candidate, entry) {
  const problems = [];
  if (!candidate.photoId) problems.push('missing photoId');
  if (!candidate.provider) problems.push('missing provider');
  if (!candidate.sourceUrl) problems.push('missing sourceUrl');
  if (!candidate.photographer) problems.push('missing photographer');
  try {
    assertProviderUrl(candidate.baseUrl);
  } catch (error) {
    problems.push(error.message);
  }
  const role = roleOf(getCategory(entry.category));
  if (role.id === 'hero' && candidate.width < 1600) {
    problems.push(`hero needs >=1600px wide, got ${candidate.width}`);
  }
  return problems;
}

/** Turn an accepted candidate into the manifest record. */
export function toRecord(entry, scored, { resolvedAt = new Date().toISOString() } = {}) {
  const c = scored.candidate;
  const role = roleOf(getCategory(entry.category));
  const responsive = responsiveSet(c, role.id);

  return {
    // identity
    country: entry.country,
    countryName: entry.countryName,
    category: entry.category,
    categoryTitle: entry.categoryTitle,
    no: entry.no,
    role: role.id,
    status: STATUS.RESOLVED,

    // authored copy
    caption: entry.caption,
    description: entry.description,
    alt: entry.alt,
    searchQuery: entry.searchQuery,

    // provider attribution — all straight from the API response
    provider: c.provider,
    photoId: c.photoId,
    imageUrl: responsive.src,
    baseUrl: c.baseUrl,
    thumbnailUrl: c.thumbnailUrl,
    sourceUrl: c.sourceUrl,
    downloadLocation: c.downloadLocation,
    photographer: c.photographer,
    photographerUrl: c.photographerUrl,

    // geometry
    width: c.width,
    height: c.height,
    aspectRatio: Number((c.width / c.height).toFixed(4)),
    focalPoint: entry.focalPoint,
    dominantColor: c.color,

    // rendering
    srcset: responsive.srcset,
    sizes: responsive.sizes,
    renderRatio: responsive.ratio,
    mobileRatio: responsive.mobileRatio,
    loading: responsive.loading,

    // provenance
    score: scored.total,
    scoreParts: scored.parts,
    resolvedAt,
  };
}

/**
 * The record written for a synthetic image.
 *
 * It shares the geometry and copy fields with a real record so the renderer
 * needs no special case to lay it out — and diverges on exactly the fields
 * that constitute a claim. photographer, photographerUrl, sourceUrl and
 * downloadLocation are null, not absent: a null that the audit can assert on
 * is stronger than a missing key it might overlook.
 */
export function toSyntheticRecord(entry, candidate, { resolvedAt = new Date().toISOString() } = {}) {
  const role = roleOf(getCategory(entry.category));
  const ratio = candidate.width / candidate.height;

  return {
    country: entry.country,
    countryName: entry.countryName,
    category: entry.category,
    categoryTitle: entry.categoryTitle,
    no: entry.no,
    role: role.id,
    status: STATUS.RESOLVED,

    caption: entry.caption,
    description: entry.description,
    alt: entry.alt,
    searchQuery: entry.searchQuery,

    // what this is
    provider: SYNTHETIC_PROVIDER,
    synthetic: true,
    sourceType: 'generated',
    generationPrompt: candidate.generationPrompt,
    generationModel: candidate.generationModel,
    generatedAt: candidate.generatedAt,
    visualDisclosure: VISUAL_DISCLOSURE,

    photoId: candidate.photoId,
    imageUrl: assertSyntheticSrc(candidate.baseUrl),
    baseUrl: candidate.baseUrl,
    thumbnailUrl: candidate.thumbnailUrl,

    // never fabricated, never inherited
    sourceUrl: null,
    downloadLocation: null,
    photographer: null,
    photographerUrl: null,

    width: candidate.width,
    height: candidate.height,
    aspectRatio: Number(ratio.toFixed(4)),
    focalPoint: entry.focalPoint,
    dominantColor: candidate.color,

    // No provider CDN to resize on, so the file is served as committed. The
    // single-entry srcset keeps the render path identical to a real record.
    srcset: null,
    sizes: role.sizes,
    renderRatio: role.ratio,
    mobileRatio: role.mobileRatio,
    loading: role.eager ? 'eager' : 'lazy',

    score: null,
    scoreParts: {},
    resolvedAt,
  };
}

/** The record written when nothing acceptable was found. */
export function toUnresolved(entry, reason, { resolvedAt = new Date().toISOString() } = {}) {
  const role = roleOf(getCategory(entry.category));
  return {
    country: entry.country,
    countryName: entry.countryName,
    category: entry.category,
    categoryTitle: entry.categoryTitle,
    no: entry.no,
    role: role.id,
    status: STATUS.UNRESOLVED,
    caption: entry.caption,
    description: entry.description,
    alt: entry.alt,
    searchQuery: entry.searchQuery,
    focalPoint: entry.focalPoint,
    renderRatio: role.ratio,
    mobileRatio: role.mobileRatio,
    provider: null,
    photoId: null,
    imageUrl: null,
    sourceUrl: null,
    photographer: null,
    reason,
    resolvedAt,
  };
}

/**
 * Resolve one country/category slot.
 *
 * @param {object} entry        expanded category entry from the country data
 * @param {object} destination  the country record (for ranking signals)
 * @param {{credentials: {unsplash: string|null, pexels: string|null},
 *          providers?: {unsplash: object, pexels: object},
 *          usedPhotoKeys?: Set<string>, only?: 'unsplash'|'pexels'|null,
 *          fetchImpl?: typeof fetch, log?: Function}} opts
 */
export async function resolveEntry(entry, destination, opts) {
  const {
    credentials,
    providers = { unsplash, pexels },
    usedPhotoKeys = new Set(),
    only = null,
    fetchImpl,
    log = () => {},
    onCandidates = null,
    allowSynthetic = true,
    syntheticDir = undefined,
  } = opts;

  const role = roleOf(getCategory(entry.category));
  const attempts = [];

  // Real photography first, always. Synthetic is never in this loop — it is
  // considered only after both real providers have failed, and only for a
  // slot the policy has cleared. A synthetic image cannot outrank a real
  // photograph because it is never ranked against one.
  const order = only && only !== SYNTHETIC_PROVIDER
    ? [only]
    : ['unsplash', 'pexels'];

  for (const providerName of order) {
    const key =
      providerName === 'unsplash' ? credentials.unsplash : credentials.pexels;
    if (!key) {
      attempts.push({ provider: providerName, error: 'no API key configured' });
      continue;
    }

    let candidates;
    try {
      candidates = await providers[providerName].search({
        query: entry.searchQuery,
        orientation: role.orientation,
        accessKey: key,
        apiKey: key,
        fetchImpl,
      });
    } catch (error) {
      attempts.push({ provider: providerName, error: error.message });
      log(`      ${providerName} error: ${error.message}`);
      continue;
    }

    if (!candidates.length) {
      attempts.push({ provider: providerName, error: 'no results' });
      continue;
    }

    // Drop anything structurally unusable before ranking spends effort on it.
    const usable = candidates.filter((c) => validateCandidate(c, entry).length === 0);
    if (!usable.length) {
      attempts.push({
        provider: providerName,
        error: `${candidates.length} results, none structurally valid`,
      });
      continue;
    }

    const { best, scored, rejected } = rankCandidates(usable, entry, destination, usedPhotoKeys);

    // Hand the ranked shortlist to the caller so the review sheet can show
    // what was considered and why it scored as it did — including the runners
    // up, which is the only way to tell a good pick from a lucky one.
    if (onCandidates) {
      onCandidates(`${entry.country}::${entry.category}`, {
        country: entry.country,
        category: entry.category,
        provider: providerName,
        searchQuery: entry.searchQuery,
        considered: usable.length,
        shortlist: scored.map((s) => ({
          ...s.candidate,
          score: s.total,
          scoreParts: s.parts,
          accepted: s.total >= ACCEPT_THRESHOLD,
        })),
      });
    }

    if (!best) {
      attempts.push({
        provider: providerName,
        error: `${usable.length} candidates, none scored >= ${ACCEPT_THRESHOLD}`,
      });
      continue;
    }

    usedPhotoKeys.add(`${best.candidate.provider}:${best.candidate.photoId}`);
    log(
      `      ${providerName} ok — score ${best.total} (${best.candidate.photoId}), ` +
        `${rejected} below threshold`,
    );
    return toRecord(entry, best);
  }

  // Last resort: a committed synthetic image, for an explicitly allowed slot.
  const eligibility = syntheticEligibility(entry, destination);
  if (allowSynthetic && eligibility.allowed) {
    const { candidate, problems } = synthetic.lookup(
      entry,
      syntheticDir ? { dir: syntheticDir } : {},
    );
    for (const problem of problems) {
      attempts.push({ provider: SYNTHETIC_PROVIDER, error: problem });
      log(`      synthetic rejected: ${problem}`);
    }
    if (candidate) {
      log(`      synthetic ok — ${candidate.photoId} (illustrative, disclosed)`);
      return toSyntheticRecord(entry, candidate);
    }
  } else if (allowSynthetic) {
    log(`      synthetic not permitted here: ${eligibility.reasons[0]}`);
  }

  const reason = attempts.length
    ? attempts.map((a) => `${a.provider}: ${a.error}`).join('; ')
    : 'no providers attempted';
  log(`      unresolved — ${reason}`);
  return toUnresolved(entry, reason);
}

/**
 * Resolve every slot for a set of destinations.
 *
 * @param {Array<object>} destinations
 * @param {object} options
 */
export async function resolveAll(destinations, options) {
  const {
    cache,
    force = false,
    categories = null,
    log = () => {},
    ...entryOpts
  } = options;

  const usedPhotoKeys = entryOpts.usedPhotoKeys ?? new Set();
  const records = [];
  const candidates = {};
  const stats = { fromCache: 0, resolved: 0, unresolved: 0 };
  const collect = (key, value) => { candidates[key] = value; };

  for (const destination of destinations) {
    log(`\n  ${destination.name}`);
    for (const entry of destination.categories) {
      if (categories && !categories.includes(entry.category)) continue;

      const cached = cache ? readCache(cache, entry, { force }) : null;
      if (cached && cached.status === STATUS.RESOLVED) {
        // Honour uniqueness across cached picks too.
        usedPhotoKeys.add(`${cached.provider}:${cached.photoId}`);
        records.push(cached);
        stats.fromCache += 1;
        continue;
      }

      log(`    ${entry.no} ${entry.categoryTitle}`);
      const record = await resolveEntry(entry, destination, {
        ...entryOpts,
        usedPhotoKeys,
        log,
        onCandidates: collect,
      });
      records.push(record);
      if (record.status === STATUS.RESOLVED) stats.resolved += 1;
      else stats.unresolved += 1;

      if (cache) writeCache(cache, entry, record);
    }
  }

  return { records, candidates, stats };
}

export { cacheKey };
