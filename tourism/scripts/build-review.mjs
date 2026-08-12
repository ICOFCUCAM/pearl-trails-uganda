#!/usr/bin/env node
/**
 * npm run tourism:review
 *
 *   --country <slug>   build one destination's sheet only (repeatable)
 *   --only-unresolved  show only slots with no accepted photograph
 *
 * Builds the comparison sheet: for every slot, the art-direction brief and the
 * generated reference image beside the ranked Unsplash and Pexels candidates,
 * each with its score breakdown. You look, you decide, you pin.
 *
 * Output goes to tourism/review/ and is NOT part of the deployed site — it is
 * a local tool. Open tourism/review/index.html in a browser.
 *
 * Pinning: each candidate has a button that copies its overrides.json entry to
 * the clipboard. Paste it into tourism/data/overrides.json, then run
 * `npm run tourism:apply-overrides && npm run tourism:build-pages`.
 */

import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_DESTINATIONS, getDestination } from '../data/countries/index.js';
import { loadManifest, indexManifest } from '../lib/manifest.js';
import { loadCandidates, shortlistFor } from '../lib/candidates.js';
import { loadOverrides } from '../lib/overrides.js';
import { buildBrief } from '../lib/prompt.js';
import { variantUrl } from '../lib/cdn.js';
import { STATUS } from '../lib/resolver.js';
import { esc } from '../lib/render.js';
import { syntheticEligibility, VISUAL_DISCLOSURE } from '../data/synthetic-policy.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REVIEW_DIR = resolve(ROOT, 'tourism/review');
const GENERATED_DIR = resolve(ROOT, 'tourism/generated');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/**
 * Index the generated references on disk. Naming convention:
 *   tourism/generated/<country>-<category>.<ext>      e.g. uganda-wildlife.png
 * A trailing -2, -3 marks alternates, which are shown alongside.
 */
function indexGenerated() {
  const found = new Map();
  if (!existsSync(GENERATED_DIR)) return found;
  for (const name of readdirSync(GENERATED_DIR)) {
    const ext = extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    const stem = basename(name, ext);
    const match = stem.match(/^([a-z-]+?)-([a-z]+?)(?:-(\d+))?$/);
    if (!match) continue;
    const key = `${match[1]}::${match[2]}`;
    if (!found.has(key)) found.set(key, []);
    found.get(key).push(name);
  }
  for (const list of found.values()) list.sort();
  return found;
}

const CSS = `
:root{--bg:#12140f;--panel:#1b1e17;--line:#2e332a;--ink:#eae6da;--dim:#9aa290;--accent:#63b58f;--warn:#d8a24a;--bad:#d2664f}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:28px}
a{color:var(--accent)}
h1{font-size:26px;letter-spacing:-.02em}
h2{font-size:17px;letter-spacing:-.01em}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.top{display:flex;flex-wrap:wrap;gap:8px 22px;align-items:baseline;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:22px}
.top nav{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}
.top nav a{font-size:12px;border:1px solid var(--line);padding:4px 9px;border-radius:3px;text-decoration:none}
.meta{font-size:12px;color:var(--dim)}
.slot{border:1px solid var(--line);background:var(--panel);border-radius:5px;margin-bottom:20px;overflow:hidden}
.slot-head{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline;padding:13px 16px;border-bottom:1px solid var(--line)}
.slot-head b{font-size:16px}
.tag{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.pill{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:99px;border:1px solid var(--line)}
.pill.ok{color:var(--accent);border-color:var(--accent)}
.pill.none{color:var(--bad);border-color:var(--bad)}
.pill.pin{color:var(--warn);border-color:var(--warn)}
.pill.synth{color:#b79cf5;border-color:#8a6bd8}
.row{display:grid;grid-template-columns:260px 1fr;gap:18px;padding:16px}
@media(max-width:900px){.row{grid-template-columns:1fr}}
.brief{font-size:12.5px}
.brief p{color:var(--dim);margin-bottom:9px}
.brief details{margin-top:9px}
.brief summary{cursor:pointer;color:var(--accent);font-size:12px}
.brief pre{white-space:pre-wrap;word-break:break-word;background:#0e100c;border:1px solid var(--line);padding:9px;border-radius:3px;font-size:11px;color:var(--dim);margin-top:7px}
.strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.cand{border:1px solid var(--line);border-radius:4px;overflow:hidden;background:#0e100c;display:flex;flex-direction:column}
.cand.is-pick{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.cand.is-ref{border-color:var(--warn)}
.cand.is-synthetic{border-color:#8a6bd8}
.badge{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;font-weight:700;padding:4px 8px;display:block;text-align:center}
.badge.real{background:#173226;color:#7fd4a8}
.badge.synth{background:#241a3d;color:#b79cf5}
.badge.ref{background:#33280f;color:var(--warn)}
.score.synth{color:#b79cf5}
/* The synthetic card's lines must never be clipped — "no photographer" is the
   whole point of the card, so it wraps rather than ellipsing. */
.cand.is-synthetic .who{white-space:normal;overflow:visible;text-overflow:clip}
.disclosure{font-size:10.5px;line-height:1.4;color:#b79cf5;border-top:1px solid var(--line);padding-top:6px}
.cand details{font-size:11px}
.cand details summary{cursor:pointer;color:var(--dim)}
.cand details pre{white-space:pre-wrap;word-break:break-word;font-size:10px;color:var(--dim);margin-top:5px}
.policy{font-size:11px;padding:7px 16px;border-bottom:1px solid var(--line);color:var(--dim)}
.policy.real-only{color:#7fd4a8}
.policy.synth-ok{color:#b79cf5}
.cand img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#000}
.cand .body{padding:9px 10px;display:flex;flex-direction:column;gap:6px;flex:1}
.cand .who{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.score{font-size:12px;font-weight:600}
.score.pass{color:var(--accent)}
.score.fail{color:var(--bad)}
.parts{font-size:10.5px;color:var(--dim);display:flex;flex-wrap:wrap;gap:2px 8px}
.parts i{font-style:normal}
.parts i.neg{color:var(--bad)}
.acts{display:flex;gap:6px;margin-top:auto;padding-top:4px}
button{font:inherit;font-size:11px;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:3px;padding:4px 8px;cursor:pointer}
button:hover{border-color:var(--accent);color:var(--accent)}
.empty{padding:16px;color:var(--dim);font-size:13px}
.copied{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--accent);color:#0d1a13;padding:9px 15px;border-radius:4px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}
.copied.on{opacity:1}
`;

const SCRIPT = `
function pin(slot, provider, photoId){
  const entry = '  "' + slot + '": { "provider": "' + provider + '", "photoId": "' + photoId + '", "why": "" },';
  navigator.clipboard.writeText(entry).then(function(){ toast('Copied — paste into tourism/data/overrides.json'); });
}
function reject(slot){
  const entry = '  "' + slot + '": { "status": "unresolved", "why": "" },';
  navigator.clipboard.writeText(entry).then(function(){ toast('Copied "none of these" entry'); });
}
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(window.__t); window.__t = setTimeout(function(){ el.classList.remove('on'); }, 2200);
}
`;

function thumb(candidate) {
  try {
    return variantUrl(candidate, { width: 400, aspect: 4 / 3, quality: 70 });
  } catch {
    return candidate.thumbnailUrl ?? '';
  }
}

function partsHtml(parts) {
  return Object.entries(parts ?? {})
    .filter(([, v]) => typeof v === 'number' && v !== 0)
    .map(([k, v]) => `<i class="${v < 0 ? 'neg' : ''}">${esc(k.slice(0, 4))} ${v > 0 ? '+' : ''}${v}</i>`)
    .join('');
}

function candidateCard(slot, candidate, isPick) {
  const src = thumb(candidate);
  const pass = candidate.accepted;
  return `
        <div class="cand${isPick ? ' is-pick' : ''}">
          <span class="badge real">Real photograph</span>
          <a href="${esc(candidate.sourceUrl)}" target="_blank" rel="noopener">
            <img src="${esc(src)}" alt="Candidate ${esc(candidate.photoId)} for ${esc(slot)}" loading="lazy">
          </a>
          <div class="body">
            <span class="score ${pass ? 'pass' : 'fail'}">${candidate.score}${pass ? '' : ' · below threshold'}</span>
            <span class="parts">${partsHtml(candidate.scoreParts)}</span>
            <span class="who">${esc(candidate.provider === 'unsplash' ? 'Unsplash' : 'Pexels')} · ${esc(candidate.photographer)}</span>
            <span class="who">${esc(candidate.width)}×${esc(candidate.height)} · ${esc((candidate.description || '').slice(0, 60))}</span>
            <div class="acts">
              <button onclick="pin('${esc(slot)}','${esc(candidate.provider)}','${esc(candidate.photoId)}')">Pin this</button>
            </div>
          </div>
        </div>`;
}

/**
 * A published synthetic image. Presented so it can never be mistaken for one
 * of the cards above: different badge, different border, no photographer line
 * at all, and the generation prompt on show rather than a credit.
 */
function syntheticCard(slot, record) {
  return `
        <div class="cand is-synthetic">
          <span class="badge synth">Synthetic / illustrative</span>
          <img src="../../${esc(String(record.imageUrl).replace(/^\//, ''))}" alt="Illustrative image for ${esc(slot)}" loading="lazy">
          <div class="body">
            <span class="score synth">Generated image</span>
            <span class="who">No photographer &mdash; nobody took this</span>
            <span class="who">${esc(record.generationModel ?? 'model not recorded')} &middot; ${esc(String(record.generatedAt ?? '').slice(0, 10))}</span>
            <details><summary>Generation prompt</summary><pre>${esc(record.generationPrompt ?? '')}</pre></details>
            <span class="disclosure">${esc(record.visualDisclosure ?? VISUAL_DISCLOSURE)}</span>
          </div>
        </div>`;
}

function referenceCard(slot, files) {
  return files
    .map(
      (file) => `
        <div class="cand is-ref">
          <span class="badge ref">Reference &mdash; never published</span>
          <img src="../generated/${esc(file)}" alt="Generated reference for ${esc(slot)}" loading="lazy">
          <div class="body">
            <span class="score">reference</span>
            <span class="who">generated · not for publication</span>
            <span class="who">${esc(file)}</span>
          </div>
        </div>`,
    )
    .join('');
}

function slotBlock(destination, entry, record, shortlist, generated, override) {
  const brief = buildBrief(entry, destination);
  const slot = `${entry.country}/${entry.category}`;
  const pickKey = record.status === STATUS.RESOLVED ? `${record.provider}:${record.photoId}` : null;

  const status = record.synthetic === true
    ? '<span class="pill synth">synthetic</span>'
    : override
      ? '<span class="pill pin">pinned</span>'
      : record.status === STATUS.RESOLVED
        ? '<span class="pill ok">real photograph</span>'
        : '<span class="pill none">unresolved</span>';

  const eligibility = syntheticEligibility(entry, destination);
  const policyLine = eligibility.allowed
    ? '<div class="policy synth-ok">Synthetic permitted here — non-specific illustrative visual. Real photography still preferred.</div>'
    : `<div class="policy real-only">Real photography only — ${esc(eligibility.reasons[0])}</div>`;

  const cards = [
    generated.length ? referenceCard(slot, generated) : '',
    record.synthetic === true ? syntheticCard(slot, record) : '',
    ...shortlist.map((c) => candidateCard(slot, c, `${c.provider}:${c.photoId}` === pickKey)),
  ]
    .filter(Boolean)
    .join('');

  return `
    <section class="slot" id="${esc(entry.category)}">
      <div class="slot-head">
        <span class="tag">${esc(entry.no)}</span>
        <b>${esc(entry.caption)}</b>
        <span class="tag">${esc(entry.categoryTitle)} · ${esc(brief.role)} · ${esc(brief.aspectRatio)}</span>
        ${status}
        <span class="meta" style="margin-left:auto">${shortlist.length} candidate(s)${generated.length ? ` · ${generated.length} reference(s)` : ''}</span>
      </div>
      ${policyLine}
      <div class="row">
        <div class="brief">
          <p><b>Looking for:</b> ${esc(entry.subject)}</p>
          <p><b>Judge by:</b> ${esc(brief.intent)}</p>
          <p class="meta">query: <code>${esc(entry.searchQuery)}</code></p>
          <details>
            <summary>Generation brief</summary>
            <pre>${esc(brief.prompt)}</pre>
            <pre>${esc(brief.composition)}</pre>
          </details>
          <div class="acts" style="margin-top:10px">
            <button onclick="reject('${esc(slot)}')">None of these</button>
          </div>
        </div>
        ${cards
          ? `<div class="strip">${cards}</div>`
          : '<div class="empty">No candidates recorded yet. Run <code>npm run tourism:resolve-images</code> — the resolver writes its shortlist to tourism/manifest/candidates.json.</div>'}
      </div>
    </section>`;
}

function page({ title, subtitle, nav, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="top">
  <h1>${esc(title)}</h1>
  <span class="meta">${esc(subtitle)}</span>
  <nav>${nav}</nav>
</div>
${body}
<div class="copied" id="toast"></div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

function main() {
  const args = process.argv.slice(2);
  const countries = [];
  let onlyUnresolved = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--country') countries.push(String(args[++i]).toLowerCase());
    else if (args[i] === '--only-unresolved') onlyUnresolved = true;
  }

  const destinations = countries.length ? countries.map(getDestination) : ALL_DESTINATIONS;
  const index = indexManifest(loadManifest());
  const store = loadCandidates();
  const generated = indexGenerated();
  const overrides = loadOverrides();

  mkdirSync(REVIEW_DIR, { recursive: true });

  const nav = ALL_DESTINATIONS.map(
    (d) => `<a href="${d.slug}.html">${esc(d.name)}</a>`,
  ).join('');

  let totalCandidates = 0;
  let totalReferences = 0;

  for (const destination of destinations) {
    const blocks = [];
    for (const entry of destination.categories) {
      const record = index.get(destination.slug, entry.category);
      if (onlyUnresolved && record.status === STATUS.RESOLVED) continue;
      const shortlist = shortlistFor(store, destination.slug, entry.category);
      const refs = generated.get(`${destination.slug}::${entry.category}`) ?? [];
      totalCandidates += shortlist.length;
      totalReferences += refs.length;
      blocks.push(
        slotBlock(
          destination,
          entry,
          record,
          shortlist,
          refs,
          overrides[`${destination.slug}/${entry.category}`],
        ),
      );
    }

    const resolved = index
      .forCountry(destination.slug)
      .filter((r) => r.status === STATUS.RESOLVED).length;

    writeFileSync(
      resolve(REVIEW_DIR, `${destination.slug}.html`),
      page({
        title: `${destination.name} — image review`,
        subtitle: `${resolved}/27 resolved · pin a choice, then run tourism:apply-overrides`,
        nav,
        body: blocks.join('\n') || '<div class="empty">Nothing to review.</div>',
      }),
      'utf8',
    );
  }

  const rows = ALL_DESTINATIONS.map((d) => {
    const records = index.forCountry(d.slug);
    const resolved = records.filter((r) => r.status === STATUS.RESOLVED).length;
    const refs = d.categories.filter((e) => generated.has(`${d.slug}::${e.category}`)).length;
    const cands = d.categories.reduce(
      (n, e) => n + shortlistFor(store, d.slug, e.category).length,
      0,
    );
    return `
    <section class="slot">
      <div class="slot-head">
        <b><a href="${d.slug}.html">${esc(d.name)}</a></b>
        <span class="tag">${esc(d.tagline)}</span>
        <span class="meta" style="margin-left:auto">${resolved}/27 resolved · ${cands} candidates · ${refs} references</span>
      </div>
    </section>`;
  }).join('\n');

  writeFileSync(
    resolve(REVIEW_DIR, 'index.html'),
    page({
      title: 'Tourism image review',
      subtitle: `${totalCandidates} candidates, ${totalReferences} generated references on disk`,
      nav,
      body: rows,
    }),
    'utf8',
  );

  console.log(`Review sheets written to ${relative(ROOT, REVIEW_DIR)}/`);
  console.log(`  destinations   ${destinations.length}`);
  console.log(`  candidates     ${totalCandidates}`);
  console.log(`  references     ${totalReferences}`);
  if (!totalCandidates) {
    console.log('\nNo candidates yet — run `npm run tourism:resolve-images` first.');
  }
  console.log(`\nOpen ${relative(ROOT, resolve(REVIEW_DIR, 'index.html'))} in a browser.`);
}

main();
