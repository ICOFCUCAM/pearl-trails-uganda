/**
 * The audit.
 *
 * Everything the brief asks to be reported is computed here so the CLI is only
 * formatting: coverage per country, provider split, unresolved slots,
 * duplicates, broken or non-provider URLs, missing captions and alt text, bad
 * aspect ratios and invalid provider records. Plus one check the brief implies
 * rather than states: that no API key leaked into a built page.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { COUNTRIES, ALL_DESTINATIONS } from '../data/countries/index.js';
import { CATEGORY_IDS, getCategory, roleOf } from '../data/categories.js';
import { STATUS } from './resolver.js';
import { assertProviderUrl } from './cdn.js';
import { getCredentials } from './env.js';
import { assertSyntheticSrc, isSyntheticSrc } from './providers/synthetic.js';
import {
  SYNTHETIC_PROVIDER,
  SYNTHETIC_ALLOWED_CATEGORIES,
  REAL_ONLY_CATEGORIES,
  VISUAL_DISCLOSURE,
  syntheticEligibility,
  isRealProvider,
} from '../data/synthetic-policy.js';

/** How far a photo's own aspect may sit from its role before it is flagged. */
const ASPECT_TOLERANCE = 2.6;

export function auditManifest(manifest) {
  const records = manifest.records;
  const byCountry = new Map();
  const issues = [];

  const add = (level, kind, message, where) =>
    issues.push({ level, kind, message, where });

  /* ---- per destination coverage ---- */
  for (const destination of ALL_DESTINATIONS) {
    const own = records.filter((r) => r.country === destination.slug);
    const seen = new Set(own.map((r) => r.category));
    const missing = CATEGORY_IDS.filter((id) => !seen.has(id));
    for (const id of missing) {
      add('error', 'missing-image', `no record for category "${id}"`, destination.slug);
    }

    const resolved = own.filter((r) => r.status === STATUS.RESOLVED);
    byCountry.set(destination.slug, {
      name: destination.name,
      isRegion: Boolean(destination.isRegion),
      total: CATEGORY_IDS.length,
      present: own.length,
      resolved: resolved.length,
      unsplash: resolved.filter((r) => r.provider === 'unsplash').length,
      pexels: resolved.filter((r) => r.provider === 'pexels').length,
      // Real and synthetic completion are counted apart, never summed into a
      // single "done". A slot filled by an illustrative image is not the same
      // as a slot filled by a photograph of the place, and the report must
      // not let the two hide behind one number.
      real: resolved.filter((r) => isRealProvider(r.provider)).length,
      synthetic: resolved.filter((r) => r.synthetic === true).length,
      unresolved: own.filter((r) => r.status === STATUS.UNRESOLVED).length,
      duplicates: 0,
    });
  }

  /* ---- duplicates: the same photograph used twice anywhere ---- */
  const photoUses = new Map();
  for (const record of records) {
    if (record.status !== STATUS.RESOLVED) continue;
    const key = `${record.provider}:${record.photoId}`;
    if (!photoUses.has(key)) photoUses.set(key, []);
    photoUses.get(key).push(record);
  }
  for (const [key, uses] of photoUses) {
    if (uses.length < 2) continue;
    const where = uses.map((u) => `${u.country}/${u.category}`).join(', ');
    add('error', 'duplicate', `photo ${key} used ${uses.length} times: ${where}`, key);
    for (const use of uses) {
      const stat = byCountry.get(use.country);
      if (stat) stat.duplicates += 1;
    }
  }

  /* ---- per record checks ---- */
  for (const record of records) {
    const where = `${record.country}/${record.category}`;

    if (!record.caption || !record.caption.trim()) {
      add('error', 'missing-caption', 'caption is empty', where);
    } else if (record.caption.toLowerCase() === record.categoryTitle.toLowerCase()) {
      add(
        'warn',
        'generic-caption',
        `caption "${record.caption}" is just the category name`,
        where,
      );
    }

    if (!record.alt || !record.alt.trim()) {
      add('error', 'missing-alt', 'alt text is empty', where);
    } else if (record.alt.length < 20) {
      add('warn', 'weak-alt', `alt text is only ${record.alt.length} chars`, where);
    } else if (/^\s*(image|photo|picture)\b/i.test(record.alt)) {
      add('warn', 'weak-alt', 'alt text starts with "image/photo"', where);
    }

    if (!record.description || !record.description.trim()) {
      add('warn', 'missing-description', 'description is empty', where);
    }

    if (record.status === STATUS.UNRESOLVED) {
      add('warn', 'unresolved', record.reason ?? 'no reason recorded', where);
      continue;
    }

    /* resolved records only, from here */

    /* ---- the authenticity audit ----
     *
     * A synthetic image is only publishable when it declares itself, carries
     * no photographic attribution, and sits in a slot the policy cleared.
     * Every one of these is an ERROR: the build fails rather than shipping an
     * image a visitor could mistake for a photograph of the place.
     */
    const claimsSynthetic =
      record.synthetic === true ||
      record.provider === SYNTHETIC_PROVIDER ||
      record.sourceType === 'generated' ||
      isSyntheticSrc(record.imageUrl);

    if (claimsSynthetic) {
      // The four flags must agree. A record that is synthetic in one field and
      // photographic in another is the exact ambiguity the policy forbids.
      if (record.synthetic !== true) {
        add('error', 'authenticity', 'looks generated but synthetic !== true', where);
      }
      if (record.provider !== SYNTHETIC_PROVIDER) {
        add('error', 'authenticity', `synthetic image has provider "${record.provider}"`, where);
      }
      if (record.sourceType !== 'generated') {
        add('error', 'authenticity', `synthetic image has sourceType "${record.sourceType}"`, where);
      }
      if (!record.visualDisclosure) {
        add('error', 'authenticity', 'synthetic image has no visualDisclosure', where);
      } else if (record.visualDisclosure !== VISUAL_DISCLOSURE) {
        add('error', 'authenticity', 'visualDisclosure text has been altered', where);
      }

      // Nothing that would dress it as a photograph.
      if (record.photographer) {
        add('error', 'authenticity', `synthetic image credits "${record.photographer}"`, where);
      }
      if (record.photographerUrl) {
        add('error', 'authenticity', 'synthetic image has a photographer URL', where);
      }
      if (record.sourceUrl) {
        add('error', 'authenticity', `synthetic image has sourceUrl ${record.sourceUrl}`, where);
      }
      if (record.downloadLocation) {
        add('error', 'authenticity', 'synthetic image has a provider download location', where);
      }
      for (const field of ['imageUrl', 'baseUrl', 'thumbnailUrl']) {
        if (/unsplash|pexels/i.test(String(record[field] ?? ''))) {
          add('error', 'authenticity', `${field} points at a stock provider`, where);
        }
      }

      // The generation record must be complete, or the disclosure is unbacked.
      for (const field of ['generationPrompt', 'generationModel', 'generatedAt']) {
        if (!record[field]) {
          add('error', 'authenticity', `synthetic image has no ${field}`, where);
        }
      }

      // The slot must be allowed — checked here and not merely at resolve
      // time, so a hand-edited manifest cannot smuggle one in.
      if (REAL_ONLY_CATEGORIES.includes(record.category)) {
        add(
          'error',
          'authenticity',
          `"${record.category}" is real-photography-only — synthetic image not permitted`,
          where,
        );
      } else if (!SYNTHETIC_ALLOWED_CATEGORIES.includes(record.category)) {
        add(
          'error',
          'authenticity',
          `"${record.category}" is not in SYNTHETIC_ALLOWED_CATEGORIES`,
          where,
        );
      } else {
        const destination = ALL_DESTINATIONS.find((d) => d.slug === record.country);
        const entry = destination?.byCategory?.[record.category];
        if (entry) {
          const { allowed, reasons } = syntheticEligibility(entry, destination);
          if (!allowed) {
            add('error', 'authenticity', `synthetic not permitted: ${reasons[0]}`, where);
          }
        }
      }

      try {
        assertSyntheticSrc(record.imageUrl);
      } catch (error) {
        add('error', 'broken-url', `imageUrl: ${error.message}`, where);
      }
      continue;
    }

    /* ---- real photography ---- */
    if (!record.provider || !['unsplash', 'pexels'].includes(record.provider)) {
      add('error', 'invalid-provider', `provider "${record.provider}"`, where);
    }
    if (!record.photoId) add('error', 'invalid-provider', 'no photoId', where);
    if (!record.photographer) {
      add('error', 'missing-attribution', 'no photographer recorded', where);
    }
    if (!record.sourceUrl) {
      add('error', 'missing-attribution', 'no sourceUrl recorded', where);
    }

    for (const [field, value] of [
      ['imageUrl', record.imageUrl],
      ['baseUrl', record.baseUrl],
    ]) {
      if (!value) {
        add('error', 'broken-url', `${field} is empty`, where);
        continue;
      }
      try {
        assertProviderUrl(value);
      } catch (error) {
        add('error', 'broken-url', `${field}: ${error.message}`, where);
      }
    }

    if (record.srcset) {
      const urls = record.srcset.split(',').map((p) => p.trim().split(/\s+/)[0]);
      for (const url of urls) {
        try {
          assertProviderUrl(url);
        } catch (error) {
          add('error', 'broken-url', `srcset: ${error.message}`, where);
          break;
        }
      }
    }

    const role = roleOf(getCategory(record.category));
    const actual = record.width / record.height;
    const ratio = actual > role.aspect ? actual / role.aspect : role.aspect / actual;
    if (!Number.isFinite(actual) || actual <= 0) {
      add('error', 'bad-aspect', 'width/height missing or zero', where);
    } else if (ratio > ASPECT_TOLERANCE) {
      add(
        'warn',
        'bad-aspect',
        `source is ${actual.toFixed(2)}:1 for a ${role.ratio} slot — heavy crop`,
        where,
      );
    }
    if (role.id === 'hero' && record.width < 1600) {
      add('error', 'bad-aspect', `hero is only ${record.width}px wide`, where);
    }

    const fp = record.focalPoint;
    if (
      !fp ||
      typeof fp.x !== 'number' ||
      typeof fp.y !== 'number' ||
      fp.x < 0 || fp.x > 100 || fp.y < 0 || fp.y > 100
    ) {
      add('error', 'bad-focal-point', `focalPoint is ${JSON.stringify(fp)}`, where);
    }
  }

  return { byCountry, issues, records };
}

/**
 * Grep the built pages for anything that looks like a leaked credential, and
 * for leftover SVG placeholders that the tourism system was meant to replace.
 */
export function auditBuiltPages(root, pages) {
  const issues = [];
  const { unsplash, pexels } = getCredentials();
  const secrets = [unsplash, pexels].filter(Boolean);

  for (const page of pages) {
    const path = resolve(root, page);
    if (!existsSync(path)) {
      issues.push({ level: 'error', kind: 'missing-page', message: 'not generated', where: page });
      continue;
    }
    const html = readFileSync(path, 'utf8');

    for (const secret of secrets) {
      if (html.includes(secret)) {
        issues.push({
          level: 'error',
          kind: 'leaked-key',
          message: 'an API key appears in the built HTML',
          where: page,
        });
      }
    }
    for (const name of ['UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY', 'Client-ID ']) {
      if (html.includes(name)) {
        issues.push({
          level: 'error',
          kind: 'leaked-key',
          message: `"${name}" appears in the built HTML`,
          where: page,
        });
      }
    }

    const svgSlots = html.match(/data-tourism="[^"]+"[^>]*src="\/images\/[^"]+\.svg"/g);
    if (svgSlots) {
      issues.push({
        level: 'warn',
        kind: 'placeholder-remaining',
        message: `${svgSlots.length} tourism slot(s) still on an SVG placeholder`,
        where: page,
      });
    }

    const imgs = html.match(/<img\b[^>]*>/g) ?? [];
    for (const img of imgs) {
      if (!/\balt=/.test(img)) {
        issues.push({
          level: 'error',
          kind: 'missing-alt',
          message: `<img> without alt: ${img.slice(0, 90)}…`,
          where: page,
        });
      }
    }
  }
  return issues;
}

export function summarise(issues) {
  const counts = {};
  for (const issue of issues) {
    counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
  }
  return {
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warn').length,
    counts,
  };
}

export { COUNTRIES, ASPECT_TOLERANCE };
