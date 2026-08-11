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
