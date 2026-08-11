#!/usr/bin/env node
/**
 * Generate the tourism pages from the manifest, and re-point the five original
 * pages at the tourism image system.
 *
 * Output (committed static HTML — the site keeps its "deploy the folder as-is"
 * property, and `vercel.json` cleanUrls makes /destinations/uganda work):
 *
 *   east-africa.html               the regional explorer
 *   destinations/<country>.html    one page per country, one shared template
 *
 * This script never contacts a provider. It reads tourism/manifest and renders
 * whatever is there — resolved photographs or honest unresolved plates.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRIES, REGION, ALL_DESTINATIONS } from '../data/countries/index.js';
import { loadManifest, indexManifest } from '../lib/manifest.js';
import { STATUS } from '../lib/resolver.js';
import { previewUrl } from '../lib/cdn.js';
import {
  esc,
  tourismHero,
  tourismParallaxSection,
  tourismCategoryGrid,
  tourismFeature,
  destinationCard,
  tourismImage,
  attribution,
} from '../lib/render.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

/* ------------------------------------------------------------------- chrome */

function masthead(current) {
  const link = (href, label) =>
    `      <a href="${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="ptu-mast">
  <div class="ptu-frame ptu-mast-in">
    <a class="ptu-mark" href="/">Pearl Trails<em>Uganda</em></a>
    <nav class="ptu-routes">
${link('/east-africa', 'East Africa')}
${link('/services', 'Itineraries')}
${link('/pricing', 'Rates &amp; Permits')}
${link('/about', 'The Operator')}
${link('/contact', 'Enquire')}
    </nav>
    <span class="ptu-lic">UTB TO/1147</span>
    <a class="btn" href="/contact">Plan a trip</a>
  </div>
</header>`;
}

const FOOTER = `<footer class="ptu-foot">
  <div class="ptu-frame">
    <div class="ptu-foot-grid">
      <div>
        <div class="ptu-foot-mark">Pearl Trails Uganda<span>Kampala &middot; Est. 2009</span></div>
        <p>A ground operator, not an agent. Our own vehicles, our own driver-guides, our own permits filed with the Uganda Wildlife Authority. Uganda is where we run; the rest of East Africa is where we send you with operators we have worked beside for years.</p>
      </div>
      <div class="ptu-foot-col">
        <b>Travel</b>
        <a href="/east-africa">East Africa</a>
        <a href="/destinations/uganda">Uganda</a>
        <a href="/services">Multi-day itineraries</a>
        <a href="/pricing">Rates &amp; permits</a>
      </div>
      <div class="ptu-foot-col">
        <b>Destinations</b>
        <a href="/destinations/kenya">Kenya</a>
        <a href="/destinations/tanzania">Tanzania</a>
        <a href="/destinations/rwanda">Rwanda</a>
        <a href="/east-africa">All fourteen</a>
      </div>
      <div class="ptu-foot-col">
        <b>Office</b>
        <span>Plot 14 Bukoto Street, Kamwokya</span>
        <span>Kampala, Uganda</span>
        <span>+256 414 555 0182</span>
        <span>trails@pearltrails.co.ug</span>
        <span>Mon&ndash;Fri 08:00&ndash;18:00 EAT, Sat to 13:00</span>
      </div>
    </div>
    <div class="ptu-foot-bar">&copy; 2026 &middot; Uganda Tourism Board licence TO/1147 &middot; Member, Association of Uganda Tour Operators &middot; <em>Photography via Unsplash and Pexels, credited per image</em></div>
  </div>
</footer>`;

const SCRIPT = `<script>
(function(){
  var rm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var lift=document.querySelectorAll('.ptu-lift');
  if('IntersectionObserver' in window && !rm){
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){en.target.classList.add('seen');io.unobserve(en.target)}})},{threshold:.08});
    lift.forEach(function(el){io.observe(el)});
  }else{lift.forEach(function(el){el.classList.add('seen')})}
})();
</script>`;

function shell({ title, description, current, hero, body, preload }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${hero ? `<meta property="og:image" content="${esc(hero)}">` : ''}
<link rel="stylesheet" href="/styles/tourism.css">
${preload ? `<link rel="preload" as="image" href="${esc(preload)}" fetchpriority="high">` : ''}
</head>
<body>
${masthead(current)}
${body}
${SCRIPT}
${FOOTER}
</body>
</html>
`;
}

/* --------------------------------------------------------------- page body */

/** Intro slab: lede, what the country is, and the resolved/unresolved counts. */
function introSlab(destination, records) {
  const resolved = records.filter((r) => r.status === STATUS.RESOLVED).length;
  const providers = new Set(
    records.filter((r) => r.status === STATUS.RESOLVED).map((r) => r.provider),
  );
  return `
<section class="ptu-slab" id="discover">
  <div class="ptu-frame">
    <div class="ptu-head ptu-lift">
      <span class="ptu-head-no">01</span>
      <h2>Discover <em>${esc(destination.name)}</em>.</h2>
      <p class="ptu-head-note">${esc(destination.summary)}</p>
    </div>
    <dl class="ptu-t-stack ptu-lift">
      <div><dt>Tourism experiences</dt><dd>27</dd></div>
      <div><dt>Photographs resolved</dt><dd>${resolved} / ${records.length}</dd></div>
      <div><dt>Providers</dt><dd>${providers.size ? [...providers].join(' + ') : 'pending'}</dd></div>
      <div><dt>Region</dt><dd>East Africa</dd></div>
    </dl>
    ${destination.advisory
      ? '<p class="ptu-t-note">Travel to parts of this country is subject to security advisories that change often. We only quote routes we can currently staff, and we will say so plainly when we cannot.</p>'
      : ''}
  </div>
</section>`;
}

/** A slab of alternating feature rows. */
function featureSlab({ no, title, note, records, id }) {
  return `
<section class="ptu-slab${no === '02' ? '' : ' wash'}"${id ? ` id="${esc(id)}"` : ''}>
  <div class="ptu-frame">
    <div class="ptu-head ptu-lift">
      <span class="ptu-head-no">${esc(no)}</span>
      <h2>${title}</h2>
      <p class="ptu-head-note">${esc(note)}</p>
    </div>
    <div class="ptu-t-features">
${records.map((r, i) => tourismFeature(r, { flip: i % 2 === 1 })).join('\n')}
    </div>
  </div>
</section>`;
}

/** The other destinations, as an explorer strip. */
function explorerStrip(current, index, { limit = 8, heading, note } = {}) {
  const others = COUNTRIES.filter((c) => c.slug !== current).slice(0, limit);
  return `
<section class="ptu-slab stock" id="explore">
  <div class="ptu-frame">
    <div class="ptu-head ptu-lift">
      <span class="ptu-head-no">EA</span>
      <h2>${heading}</h2>
      <p class="ptu-head-note">${esc(note)}</p>
    </div>
    <div class="ptu-t-dests ptu-lift">
${others.map((c) => destinationCard(c, index.get(c.slug, 'hero'))).join('\n')}
    </div>
    <div class="ptu-acts"><a class="ptu-go" href="/east-africa">All fourteen countries</a></div>
  </div>
</section>`;
}

function ctaSlab(destination) {
  return `
<section class="ptu-slab short wash">
  <div class="ptu-frame">
    <div class="ptu-head ptu-lift">
      <span class="ptu-head-no">&rarr;</span>
      <h2>Plan ${esc(destination.name)} <em>day by day</em>.</h2>
      <p class="ptu-head-note">Every itinerary is written out before you pay anything, with real driving times and permits filed in your name at the published price.</p>
    </div>
    <div class="ptu-acts ptu-lift">
      <a class="ptu-go" href="/contact">Ask about dates</a>
      <a class="ptu-go faint" href="/pricing">Rates &amp; permits</a>
    </div>
  </div>
</section>`;
}

/**
 * The country page. One template, fifteen destinations — Uganda included.
 * The section order follows the reference sequence: hero, discover, wildlife
 * and safari, landscape band, water and altitude, scenic band, culture and
 * adventure, closing band, all 27, hidden gems and eco tourism, explorer.
 */
function countryPage(destination, index) {
  const rec = (id) => index.get(destination.slug, id);
  const records = index.forCountry(destination.slug);
  const hero = rec('hero');
  const heroPreload =
    hero.status === STATUS.RESOLVED ? previewUrl(hero, 1920) : null;

  const body = [
    tourismHero(destination, hero),
    introSlab(destination, records),
    featureSlab({
      no: '02',
      title: 'Wildlife and the <em>game roads</em>.',
      note: 'What lives here, and how you go and look at it.',
      records: [rec('wildlife'), rec('safari')],
      id: 'wildlife',
    }),
    tourismParallaxSection(rec('nature'), {
      variant: 'forest',
      foot: `${destination.name} · ${rec('nature').categoryTitle}`,
    }),
    featureSlab({
      no: '03',
      title: 'Water, forest and <em>altitude</em>.',
      note: 'Lakes and rivers, the high ground above them, and what falls in between.',
      records: [rec('lakes'), rec('mountains'), rec('waterfalls'), rec('forests')],
      id: 'landscape',
    }),
    tourismParallaxSection(rec('scenic'), {
      variant: 'rift',
      foot: `${destination.name} · ${rec('scenic').categoryTitle}`,
    }),
    featureSlab({
      no: '04',
      title: 'Culture, people and <em>going outside</em>.',
      note: 'The part of a country you cannot photograph from a vehicle window.',
      records: [rec('culture'), rec('people'), rec('adventure'), rec('beaches')],
      id: 'culture',
    }),
    tourismParallaxSection(rec('whyvisit'), {
      variant: 'forest',
      foot: `${destination.name} · ${rec('whyvisit').categoryTitle}`,
    }),
    featureSlab({
      no: '05',
      title: 'Hidden ground, <em>kept ground</em>.',
      note: 'The detours worth taking, the conservation that pays for them, and the quiet end of the accommodation.',
      records: [rec('hiddengems'), rec('ecotourism'), rec('luxury')],
      id: 'hidden',
    }),
    tourismCategoryGrid(records, {
      id: 'experiences',
      title: `Twenty-seven ways to see <em>${esc(destination.name)}</em>.`,
      note:
        'Every destination on this site carries the same twenty-seven tourism ' +
        'experiences, each with its own photograph, caption and source.',
    }),
    explorerStrip(destination.slug, index, {
      heading: 'The rest of <em>East Africa</em>.',
      note: 'Fourteen countries, one region, the same twenty-seven experiences each.',
    }),
    ctaSlab(destination),
  ].join('\n');

  return shell({
    title: `${destination.name} — ${destination.tagline} | Pearl Trails Uganda`,
    description: destination.lede,
    current: '/east-africa',
    hero: heroPreload,
    preload: heroPreload,
    body,
  });
}

/** The regional overview page. */
function regionPage(index) {
  const rec = (id) => index.get(REGION.slug, id);
  const records = index.forCountry(REGION.slug);
  const hero = rec('hero');
  const heroPreload = hero.status === STATUS.RESOLVED ? previewUrl(hero, 1920) : null;

  const body = [
    tourismHero(REGION, hero),
    introSlab(REGION, records),
    `
<section class="ptu-slab" id="countries">
  <div class="ptu-frame">
    <div class="ptu-head ptu-lift">
      <span class="ptu-head-no">14</span>
      <h2>Fourteen countries, <em>one region</em>.</h2>
      <p class="ptu-head-note">Uganda is where we run our own vehicles and guides. The rest we arrange with operators we have worked beside for years — and every one of them gets the same twenty-seven tourism experiences here.</p>
    </div>
    <div class="ptu-t-dests ptu-lift">
${COUNTRIES.map((c) => destinationCard(c, index.get(c.slug, 'hero'))).join('\n')}
    </div>
  </div>
</section>`,
    tourismParallaxSection(rec('wildlife'), {
      variant: 'forest',
      foot: 'East Africa · Wildlife',
    }),
    featureSlab({
      no: '02',
      title: 'What the <em>rift</em> made.',
      note: 'The same geological accident produced the glaciers, the soda lakes, the savannah and the islands.',
      records: [rec('nature'), rec('mountains'), rec('lakes'), rec('beaches')],
      id: 'landscape',
    }),
    tourismParallaxSection(rec('scenic'), {
      variant: 'rift',
      foot: 'East Africa · Scenic Views',
    }),
    featureSlab({
      no: '03',
      title: 'People, culture and <em>the road</em>.',
      note: 'A region with hundreds of languages and no single story.',
      records: [rec('culture'), rec('people'), rec('adventure'), rec('ecotourism')],
      id: 'culture',
    }),
    tourismCategoryGrid(records, {
      id: 'experiences',
      title: 'East Africa in <em>twenty-seven frames</em>.',
      note: 'The regional set. Each country carries its own version of the same twenty-seven.',
    }),
    ctaSlab(REGION),
  ].join('\n');

  return shell({
    title: 'East Africa — One Region, Every Landscape | Pearl Trails Uganda',
    description: REGION.lede,
    current: '/east-africa',
    hero: heroPreload,
    preload: heroPreload,
    body,
  });
}

/* ---------------------------------------------- existing-page image rewrite */

/**
 * The five original pages carry `data-tourism="country/category"` on each
 * image, plus `data-tourism-role` naming the slot they sit in.
 *
 * Two rules make this safe to run on every build:
 *
 *   1. An <img> stays an <img>. Only src/srcset/sizes/alt/loading are
 *      rewritten, so the marker survives and the rewrite is idempotent —
 *      running it twice is the same as running it once.
 *   2. An unresolved slot is left completely alone. Those pages carry their
 *      CSS inline and do not link the tourism stylesheet, so an unresolved
 *      plate would render unstyled; the original labelled SVG placeholder is
 *      the better honest stand-in, and `tourism:validate` reports every page
 *      still sitting on one.
 */
export function rewriteSlots(html, index) {
  return html.replace(
    /<img\b[^>]*\bdata-tourism="([a-z-]+)\/([a-z]+)"[^>]*>/g,
    (match, country, category) => {
      const record = index.get(country, category);
      if (record.status !== STATUS.RESOLVED) return match;

      const eager = /\bdata-tourism-eager\b/.test(match);
      const roleMatch = match.match(/\bdata-tourism-role="([a-z]+)"/);
      const classMatch = match.match(/\bclass="([^"]*)"/);

      const rendered = tourismImage(record, {
        eager,
        role: roleMatch ? roleMatch[1] : undefined,
        className: classMatch ? classMatch[1] : '',
      });

      // Re-attach the markers so the next build can find this slot again.
      const markers =
        `data-tourism="${country}/${category}"` +
        (roleMatch ? ` data-tourism-role="${roleMatch[1]}"` : '') +
        (eager ? ' data-tourism-eager' : '');
      return rendered.replace('<img ', `<img ${markers} `);
    },
  );
}

function rewriteExistingPages(index) {
  const pages = ['index.html', 'services.html', 'about.html', 'contact.html', 'pricing.html'];
  const touched = [];

  for (const page of pages) {
    const path = resolve(ROOT, page);
    if (!existsSync(path)) continue;
    const original = readFileSync(path, 'utf8');
    const next = rewriteSlots(original, index);
    if (next !== original) {
      writeFileSync(path, next, 'utf8');
      touched.push(page);
    }
  }
  return touched;
}

/* --------------------------------------------------------------------- main */

function main() {
  const index = indexManifest(loadManifest());

  mkdirSync(resolve(ROOT, 'destinations'), { recursive: true });

  const written = [];
  for (const country of COUNTRIES) {
    const out = resolve(ROOT, 'destinations', `${country.slug}.html`);
    writeFileSync(out, countryPage(country, index), 'utf8');
    written.push(`destinations/${country.slug}.html`);
  }

  writeFileSync(resolve(ROOT, 'east-africa.html'), regionPage(index), 'utf8');
  written.push('east-africa.html');

  const rewritten = rewriteExistingPages(index);

  const resolved = index.records.filter((r) => r.status === STATUS.RESOLVED).length;
  console.log(`Generated ${written.length} pages:`);
  for (const page of written) console.log(`  ${page}`);
  if (rewritten.length) {
    console.log(`Re-pointed images on: ${rewritten.join(', ')}`);
  }
  console.log(
    `Manifest: ${resolved}/${index.records.length} photographs resolved` +
      (resolved === 0
        ? ' — run `npm run tourism:resolve-images` with provider keys to populate.'
        : '.'),
  );
}

// Only build when invoked directly — tests import the renderers.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}

export { countryPage, regionPage, rewriteExistingPages, shell };
