/**
 * Tourism components.
 *
 * These are the reusable renderers — one set, shared by all fifteen
 * destinations. There is no per-country component anywhere in this project;
 * a country is a data file, and these functions turn a manifest record into
 * markup that matches the existing equatorial-fieldbook design system.
 *
 *   tourismImage           the primitive — responsive, focal-point aware
 *   tourismHero            full-bleed opener
 *   tourismParallaxSection fixed-window band (reuses .ptu-still)
 *   tourismCategoryCard    one category tile
 *   tourismCategoryGrid    the 27-category grid
 *   destinationCard        one country tile on the explorer
 *   tourismFeature         alternating image/copy row
 *
 * An unresolved record never renders a fake photograph. It renders a
 * typographic plate that occupies the same box, so the layout is identical
 * whether or not the API has been run.
 */

import { STATUS } from './resolver.js';
import { getRole } from '../data/categories.js';
import { responsiveSet } from './cdn.js';

/** Escape for HTML text and double-quoted attribute values. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** object-position / background-position from the stored focal point. */
export function focalPosition(record) {
  const { x = 50, y = 50 } = record.focalPoint ?? {};
  return `${x}% ${y}%`;
}

/**
 * The unresolved plate. Deliberately typographic and clearly not a photograph:
 * it states what the slot is for and that the image is pending, rather than
 * pretending to be imagery.
 */
function unresolvedPlate(record, { className = '', decorative = false, role: roleOverride = null } = {}) {
  const role = getRole(roleOverride ?? record.role);
  const cls = ['ptu-t-unres', decorative ? 'is-quiet' : '', className]
    .filter(Boolean)
    .join(' ');
  const open =
    `<div class="${cls}" style="--t-ratio:${role.ratio};--t-ratio-m:${role.mobileRatio}"`;

  // Behind a hero or a band the copy is already on top of the plate, so the
  // plate must not repeat the caption — it carries only the pending note.
  if (decorative) {
    return (
      `${open} aria-hidden="true">` +
      `<span class="ptu-t-unres-note">Photograph pending &middot; ${esc(record.categoryTitle)}</span>` +
      '</div>'
    );
  }

  return (
    `${open} role="img" aria-label="${esc(record.alt)} — photograph pending">` +
    `<span class="ptu-t-unres-no">${esc(record.no)}</span>` +
    `<span class="ptu-t-unres-cap">${esc(record.caption)}</span>` +
    `<span class="ptu-t-unres-note">Photograph pending &middot; ${esc(record.categoryTitle)}</span>` +
    '</div>'
  );
}

/**
 * The image primitive.
 *
 * `role` re-shapes the responsive set for the slot the image is being placed
 * in, which matters when a record appears in more than one context: the hero
 * photograph also appears as a card in the 27-grid, and a card must not
 * download the 2400px 21:9 hero file to fill a 4:3 box.
 *
 * Eagerness is caller-controlled, never inherited from the record — the same
 * hero record is above the fold once and far below it in the grid.
 *
 * @param {object} record   manifest record
 * @param {{className?: string, decorative?: boolean, eager?: boolean,
 *          sizes?: string, role?: string}} [opts]
 */
export function tourismImage(record, opts = {}) {
  const { className = '', decorative = false, eager = false, sizes = null, role: roleOverride = null } = opts;

  if (record.status !== STATUS.RESOLVED) {
    return unresolvedPlate(record, { className, decorative, role: roleOverride });
  }

  const roleId = roleOverride ?? record.role;
  const role = getRole(roleId);
  // Always derived from the role, so the width/height attributes describe the
  // crop the CDN will actually return rather than the source photograph's
  // dimensions. Mismatched intrinsic size is a layout-shift source.
  const shaped = responsiveSet(record, roleId);

  const loading = eager ? 'eager' : 'lazy';
  const attrs = [
    `src="${esc(shaped.src)}"`,
    shaped.srcset ? `srcset="${esc(shaped.srcset)}"` : '',
    `sizes="${esc(sizes ?? shaped.sizes ?? role.sizes)}"`,
    `alt="${decorative ? '' : esc(record.alt)}"`,
    decorative ? 'aria-hidden="true"' : '',
    `loading="${loading}"`,
    loading === 'eager' ? 'fetchpriority="high"' : '',
    'decoding="async"',
    `width="${shaped.width}"`,
    `height="${shaped.height}"`,
    className ? `class="${esc(className)}"` : '',
    `style="object-position:${focalPosition(record)}"`,
  ].filter(Boolean);

  return `<img ${attrs.join(' ')}>`;
}

/** Provider attribution line. Required by both providers' terms. */
export function attribution(record) {
  if (record.status !== STATUS.RESOLVED) return '';
  const who = record.photographerUrl
    ? `<a href="${esc(record.photographerUrl)}" rel="noopener nofollow">${esc(record.photographer)}</a>`
    : esc(record.photographer);
  const where = record.provider === 'unsplash' ? 'Unsplash' : 'Pexels';
  return (
    `<span class="ptu-t-credit">Photograph ${who} &middot; ` +
    `<a href="${esc(record.sourceUrl)}" rel="noopener nofollow">${where}</a></span>`
  );
}

/* ------------------------------------------------------------------ components */

/** Full-bleed destination hero. */
export function tourismHero(destination, record, { ctaHref = '/contact' } = {}) {
  const resolved = record.status === STATUS.RESOLVED;
  return `
<section class="ptu-t-hero${resolved ? '' : ' is-unresolved'}">
  <div class="ptu-t-hero-pic">
    ${resolved ? tourismImage(record, { eager: true, sizes: '100vw' }) : unresolvedPlate(record, { decorative: true })}
    <span class="ptu-t-hero-veil" aria-hidden="true"></span>
  </div>
  <div class="ptu-frame ptu-t-hero-copy">
    <span class="ptu-tag">${esc(destination.eyebrow)}</span>
    <h1>${esc(destination.name)}<em>${esc(destination.tagline)}</em></h1>
    <p class="ptu-t-hero-lede">${esc(destination.lede)}</p>
    <div class="ptu-acts">
      <a class="ptu-go ptu-t-go" href="${esc(ctaHref)}">Ask about ${esc(destination.name)}</a>
      <a class="ptu-go ptu-t-go faint" href="#experiences">The 27 experiences</a>
    </div>
  </div>
  ${resolved ? `<div class="ptu-frame ptu-t-hero-credit">${attribution(record)}</div>` : ''}
</section>`;
}

/**
 * Fixed-window parallax band. Reuses .ptu-still verbatim, including its
 * constraint: nothing between the picture and <html> may create a containing
 * block, so no transform/filter/will-change is emitted here. On narrow
 * viewports the CSS drops the fixed positioning entirely rather than shipping
 * a second image.
 */
export function tourismParallaxSection(record, { variant = 'forest', foot = '' } = {}) {
  const resolved = record.status === STATUS.RESOLVED;
  return `
<section class="ptu-still ptu-still--${variant} ptu-t-band" data-fixed-window>
  <div class="ptu-still-pic" data-fixed-window-picture>
    ${resolved
      ? tourismImage(record, { sizes: '100vw' })
      : unresolvedPlate(record, { decorative: true, className: 'is-band' })}
    <span class="ptu-still-veil" aria-hidden="true"></span>
  </div>
  <div class="ptu-still-copy" data-fixed-window-copy>
    <div class="ptu-still-in">
      <span class="ptu-still-eye">${esc(record.no)} &middot; ${esc(record.categoryTitle)}</span>
      <h2>${esc(record.caption)}</h2>
      <p>${esc(record.description)}</p>
      ${foot ? `<span class="ptu-still-foot">${esc(foot)}</span>` : ''}
    </div>
  </div>
</section>`;
}

/** One category tile. */
export function tourismCategoryCard(record) {
  return `
      <article class="ptu-t-card">
        <div class="ptu-t-card-pic">${tourismImage(record, { role: 'card' })}</div>
        <b>${esc(record.caption)}</b>
        <span class="ptu-t-card-co">${esc(record.no)} &middot; ${esc(record.categoryTitle)}</span>
        <p>${esc(record.description)}</p>
        ${attribution(record)}
      </article>`;
}

/** The full 27-category grid for a destination. */
export function tourismCategoryGrid(records, { id = 'experiences', title, note } = {}) {
  return `
<section class="ptu-slab stock" id="${esc(id)}">
  <div class="ptu-frame">
    <div class="ptu-head ptu-lift">
      <span class="ptu-head-no">27</span>
      <h2>${title}</h2>
      <p class="ptu-head-note">${esc(note)}</p>
    </div>
    <div class="ptu-t-grid">
      ${records.map(tourismCategoryCard).join('\n')}
    </div>
  </div>
</section>`;
}

/** Alternating feature row: image one side, copy the other. */
export function tourismFeature(record, { flip = false, kicker = '' } = {}) {
  return `
      <article class="ptu-t-feature${flip ? ' flip' : ''} ptu-lift">
        <div class="ptu-t-feature-pic">${tourismImage(record, { role: 'feature' })}</div>
        <div class="ptu-t-feature-body">
          <span class="ptu-t-feature-no">${esc(record.no)} &middot; ${esc(record.categoryTitle)}</span>
          <h3>${esc(record.caption)}</h3>
          <p>${esc(record.description)}</p>
          ${kicker ? `<span class="ptu-t-feature-foot">${esc(kicker)}</span>` : ''}
          ${attribution(record)}
        </div>
      </article>`;
}

/** One country tile on the East Africa explorer. */
export function destinationCard(destination, record) {
  return `
      <a class="ptu-t-dest" href="/destinations/${esc(destination.slug)}">
        <div class="ptu-t-dest-pic">${tourismImage(record, { role: 'portrait' })}</div>
        <b>${esc(destination.name)}</b>
        <span class="ptu-t-dest-co">${esc(destination.tagline)}</span>
        <p>${esc(destination.summary)}</p>
      </a>`;
}

export const __test__ = { unresolvedPlate };
