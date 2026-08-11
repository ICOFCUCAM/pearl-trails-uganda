/**
 * Provider CDN URL shaping.
 *
 * Both providers serve resizing parameters on their own image hosts, so a card
 * asks for a 600px file and a hero asks for 2400px from the *same* record —
 * no duplicate downloads, no 2400px image behind a thumbnail.
 *
 * The base URL always comes from the API response. This module only appends
 * documented query parameters to it; it never assembles a path or an id.
 */

import { getRole } from '../data/categories.js';

const ALLOWED_HOSTS = new Set(['images.unsplash.com', 'images.pexels.com']);

/** Throws on anything that is not a provider CDN URL we recognise. */
export function assertProviderUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Image URL must be https: ${url}`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Unrecognised image host "${parsed.hostname}" in ${url}`);
  }
  return parsed;
}

/**
 * Build a sized variant.
 *
 * @param {{provider: string, baseUrl: string}} record
 * @param {{width: number, aspect?: number|null, focalPoint?: {x:number,y:number},
 *          quality?: number}} opts
 */
export function variantUrl(record, { width, aspect = null, quality = 85 } = {}) {
  const url = assertProviderUrl(record.baseUrl);
  const w = Math.round(width);

  if (record.provider === 'unsplash') {
    // Imgix parameters, documented by Unsplash for the `raw` URL.
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('q', String(quality));
    url.searchParams.set('w', String(w));
    if (aspect) url.searchParams.set('h', String(Math.round(w / aspect)));
    // `entropy` beats a blind centre crop when the subject is off-centre; the
    // stored focal point then fine-tunes placement in CSS.
    if (aspect) url.searchParams.set('crop', 'entropy');
    return url.toString();
  }

  if (record.provider === 'pexels') {
    url.searchParams.set('auto', 'compress');
    url.searchParams.set('cs', 'tinysrgb');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('w', String(w));
    if (aspect) url.searchParams.set('h', String(Math.round(w / aspect)));
    return url.toString();
  }

  throw new Error(`Unknown provider "${record.provider}"`);
}

/**
 * The full responsive set for a render role: a src, a srcset ladder and the
 * matching `sizes`. `aspect` is applied so the CDN returns the crop the layout
 * actually reserves space for — that is what removes layout shift.
 */
export function responsiveSet(record, roleId) {
  const role = getRole(roleId);
  const widths = role.widths.filter((w) => w <= record.width || w === role.widths[0]);
  const ladder = widths.length ? widths : [role.widths[0]];

  const srcset = ladder
    .map((w) => `${variantUrl(record, { width: w, aspect: role.aspect })} ${w}w`)
    .join(', ');

  return {
    src: variantUrl(record, {
      width: ladder[Math.min(1, ladder.length - 1)],
      aspect: role.aspect,
    }),
    srcset,
    sizes: role.sizes,
    width: ladder[ladder.length - 1],
    height: Math.round(ladder[ladder.length - 1] / role.aspect),
    ratio: role.ratio,
    mobileRatio: role.mobileRatio,
    loading: role.eager ? 'eager' : 'lazy',
    fetchpriority: role.eager ? 'high' : 'auto',
  };
}

/** A small, cheap URL for use in `<link rel=preload>` and og:image. */
export function previewUrl(record, width = 1200) {
  return variantUrl(record, { width, aspect: 16 / 9 });
}
