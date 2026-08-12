/**
 * The synthetic provider — third and last in the preference order.
 *
 * It is unlike the other two in every way that matters. It contacts nothing:
 * a synthetic image is a file you committed, with a sidecar recording how it
 * was made. There is no search, no ranking against a query, no photographer,
 * and no provider source URL, because there is no photographer and no provider.
 *
 * A synthetic candidate is only ever offered for a slot the policy has already
 * cleared. This module does not decide eligibility — synthetic-policy.js does —
 * but it refuses to produce a candidate that lacks the metadata the disclosure
 * depends on, so an image can never reach a page without the caption that says
 * what it is.
 *
 * Layout (both files required, committed, public):
 *
 *   assets/synthetic/<country>-<category>.webp
 *   assets/synthetic/<country>-<category>.json
 *
 * The sidecar:
 *
 *   {
 *     "generationPrompt": "Cinematic atmospheric interpretation of …",
 *     "generationModel":  "some-image-model-v3",
 *     "generatedAt":      "2026-08-12T09:14:00Z",
 *     "width": 2400, "height": 1029,
 *     "dominantColor": "#2b3a2e"
 *   }
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SYNTHETIC_PROVIDER,
  VISUAL_DISCLOSURE,
} from '../../data/synthetic-policy.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SYNTHETIC_DIR = resolve(HERE, '../../../assets/synthetic');
export const SYNTHETIC_URL_PREFIX = '/assets/synthetic/';

const EXTENSIONS = ['.webp', '.avif', '.jpg', '.jpeg', '.png'];

/** Required sidecar fields. Missing any one of them disqualifies the image. */
const REQUIRED = ['generationPrompt', 'generationModel', 'generatedAt', 'width', 'height'];

/**
 * Look for a committed synthetic image for a slot.
 *
 * @returns {{candidate: object|null, problems: string[]}}
 */
export function lookup(entry, { dir = SYNTHETIC_DIR } = {}) {
  const stem = `${entry.country}-${entry.category}`;
  const problems = [];

  const ext = EXTENSIONS.find((e) => existsSync(resolve(dir, `${stem}${e}`)));
  if (!ext) return { candidate: null, problems: [] };

  const sidecarPath = resolve(dir, `${stem}.json`);
  if (!existsSync(sidecarPath)) {
    problems.push(
      `${stem}${ext} has no ${stem}.json sidecar — a synthetic image without its ` +
        'generation record cannot be published',
    );
    return { candidate: null, problems };
  }

  let meta;
  try {
    meta = JSON.parse(readFileSync(sidecarPath, 'utf8'));
  } catch (error) {
    problems.push(`${stem}.json is not valid JSON: ${error.message}`);
    return { candidate: null, problems };
  }

  const missing = REQUIRED.filter((field) => !meta[field]);
  if (missing.length) {
    problems.push(`${stem}.json is missing: ${missing.join(', ')}`);
    return { candidate: null, problems };
  }

  // Anything that would dress a generated image as a photograph is refused
  // outright rather than quietly dropped, because a sidecar carrying a
  // photographer name is evidence of a misunderstanding worth surfacing.
  for (const forbidden of ['photographer', 'photographerUrl', 'sourceUrl', 'provider']) {
    if (meta[forbidden]) {
      problems.push(
        `${stem}.json sets "${forbidden}" — synthetic images carry no ` +
          'photographer, no source URL and no provider attribution',
      );
      return { candidate: null, problems };
    }
  }

  return {
    candidate: {
      provider: SYNTHETIC_PROVIDER,
      synthetic: true,
      sourceType: 'generated',

      // identity is the file itself; there is no upstream id to borrow
      photoId: stem,
      baseUrl: `${SYNTHETIC_URL_PREFIX}${stem}${ext}`,
      thumbnailUrl: `${SYNTHETIC_URL_PREFIX}${stem}${ext}`,

      // deliberately null — never invented, never inherited
      sourceUrl: null,
      downloadLocation: null,
      photographer: null,
      photographerUrl: null,

      width: Number(meta.width),
      height: Number(meta.height),
      color: meta.dominantColor ?? null,
      description: meta.generationPrompt,

      generationPrompt: meta.generationPrompt,
      generationModel: meta.generationModel,
      generatedAt: meta.generatedAt,
      visualDisclosure: VISUAL_DISCLOSURE,
    },
    problems,
  };
}

/** True for a src that points at the committed synthetic directory. */
export function isSyntheticSrc(src) {
  return typeof src === 'string' && src.startsWith(SYNTHETIC_URL_PREFIX);
}

/**
 * Guard for a synthetic image path. Site-relative only: no protocol, no host,
 * no traversal out of the synthetic directory.
 */
export function assertSyntheticSrc(src) {
  if (!isSyntheticSrc(src)) {
    throw new Error(`Synthetic image must live under ${SYNTHETIC_URL_PREFIX}, got: ${src}`);
  }
  if (src.includes('..') || src.includes('//')) {
    throw new Error(`Suspicious synthetic path: ${src}`);
  }
  if (!EXTENSIONS.includes(extname(src).toLowerCase())) {
    throw new Error(`Unsupported synthetic image type: ${src}`);
  }
  return src;
}
