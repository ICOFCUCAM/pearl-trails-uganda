# Pearl Trails Uganda

Gorilla and chimpanzee trekking, the savannah parks, the Nile at Jinja and the Rwenzori — a Ugandan ground operator's website.

Twenty pages of static HTML: home, services, pricing, about, contact, an East Africa
overview and one tourism page for each of fourteen countries. Still no framework and no
runtime dependencies — every page is committed HTML and CSS. Deploy the folder as-is.

The only Node code in the repository is build-time tooling for the tourism image system
(`tourism/`), which never ships to the browser.

## Deploying

Import the repository into Vercel (or any static host) and deploy. There is nothing to
configure: `vercel.json` sets `cleanUrls`, so `/services` serves `services.html` and
`/destinations/uganda` serves `destinations/uganda.html`.

## The East Africa tourism image system

Fourteen countries plus a regional overview, each carrying the same twenty-seven tourism
categories — 405 image slots in total. Photographs come from **Unsplash** (primary) and
**Pexels** (fallback) through their official APIs.

**The rule that shapes everything: no URL is ever invented.** Image URLs, photo ids,
page links and photographer credits are taken verbatim from the API response. When
neither provider returns a photograph that clears the ranking threshold, the slot is
recorded as `unresolved` with the reason, renders as a typographic plate occupying the
same box, and is reported by the audit. There is no code path that fabricates a CDN URL,
guesses a photo id, or turns a page slug into an image path — and `npm run lint` fails
the build if one is added.

### Running it

```sh
cp .env.example .env      # add UNSPLASH_ACCESS_KEY and PEXELS_API_KEY
npm run tourism:resolve-images    # hit the APIs, rank, cache, write the manifest
npm run tourism:build-pages       # regenerate the HTML from the manifest
npm run tourism:validate          # audit coverage, URLs, duplicates, alt text
```

`resolve-images` accepts `--country <slug>`, `--category <id>`, `--provider unsplash|pexels`,
`--force` and `--dry-run`; all are repeatable where it makes sense. Resolution is cached
for 90 days in `tourism/cache/`, so adding one country does not re-spend the API budget
on the other thirteen. `build-pages` and `validate` never contact a provider — they read
`tourism/manifest/tourism-images.json`, so a deploy cannot be broken by a provider outage.

Keys are read only by the scripts, from the environment or `.env`. They are never written
into a page; `tourism:validate` greps the built HTML to prove it.

Already-resolved slots are seeded from the committed manifest, so re-running the resolver
costs nothing for photographs you already have — only the gaps are retried. That matters
under Unsplash's Demo tier, whose hourly allowance is smaller than a full run (~27
requests per destination, fifteen destinations). Work through it a country at a time until
your app is approved for Production:

```sh
npm run tourism:resolve-images -- --country uganda
npm run tourism:resolve-images -- --country kenya     # an hour later
```

### Choosing between candidates

The ranker is good at "is this the right country and the right subject". It cannot judge
whether a photograph is actually the one you want. Three commands close that gap:

```sh
npm run tourism:prompts           # 405 art-direction briefs, one per slot
npm run tourism:review            # contact sheet: references beside ranked candidates
npm run tourism:apply-overrides   # apply your pinned choices to the manifest
```

**`tourism:prompts`** composes a generation brief for every slot from data already in the
repo — the country's own look, the category's photographic intent, the authored subject,
and the render role's aspect ratio and negative-space requirements. Output goes to
`tourism/prompts/`: one paste-ready `.md` per destination, plus a JSON file for tooling.
It generates nothing itself; it emits the instructions you feed to an image generator.

Put the results in `tourism/generated/` as `<country>-<category>.<ext>`. They are
**reference targets** — the shot you are trying to find, used to judge the stock
candidates. `tourism/generated/README.md` sets out what would have to be true before one
of them belonged on the site itself; the short version is that a generated image of
Bwindi is not a photograph of Bwindi, and a tourism page implies the latter.

**`tourism:review`** builds `tourism/review/index.html` — for each slot, the brief and the
generated reference beside the ranked Unsplash and Pexels candidates, each with its score
breakdown so a bad pick can be explained rather than guessed at. Every candidate has a
"Pin this" button that copies its `overrides.json` entry to the clipboard, and every slot
has "None of these".

**`tourism/data/overrides.json`** is the human verdict, and it wins:

```json
{
  "uganda/wildlife": { "provider": "unsplash", "photoId": "abc123", "why": "the ranker picked a lowland gorilla" },
  "uganda/beaches":  { "status": "unresolved", "why": "every result is an ocean beach" }
}
```

An override can only name a photograph already in `tourism/manifest/candidates.json`, so
applying one needs no API call and cannot fabricate anything — the full provider response
is on disk. Naming a photo that was never a candidate is an error that leaves the manifest
untouched, rather than a silent no-op that lets you think your decision took effect.
Hand-pinning is also the easiest way to use one photograph twice, so a duplicate check
runs after overrides are applied.

### Running it on GitHub instead

`.github/workflows/tourism-images.yml` does the same three steps and opens a pull request
with the result. It runs on demand (with `country` / `category` / `provider` / `force`
inputs) and monthly. It needs two **repository** secrets — Settings → Secrets and
variables → Actions:

- `UNSPLASH_ACCESS_KEY`
- `PEXELS_API_KEY`

Those are the only place credentials belong. In particular they do **not** go in Vercel's
environment variables: Vercel serves committed HTML and never runs the resolver, so a key
there would be exposure without purpose.

### Where things live

| Path | What it is |
| --- | --- |
| `tourism/data/categories.js` | The 27 categories and their render roles (crop, width ladder, `sizes`) |
| `tourism/data/countries/*.js` | One file per country: identity, signature place names, and 27 authored captions |
| `tourism/lib/providers/` | Unsplash and Pexels API clients |
| `tourism/lib/ranking.js` | Candidate scoring — country relevance, category fit, quality, crop, authenticity |
| `tourism/lib/resolver.js` | Unsplash → Pexels → unresolved, with validation and caching |
| `tourism/lib/render.js` | The shared components; there is no per-country component anywhere |
| `styles/tourism.css` | The stylesheet the fifteen generated pages share |

Adding a country is one data file plus one line in `tourism/data/countries/index.js`.
Every other country then automatically learns to avoid its landmarks: a country's
`signature` terms become every other country's negative terms, which is what stops
"Uganda + Beaches" resolving to a Zanzibar photograph.

### Changing a caption

Edit the country's data file and run `npm run tourism:build-pages`. Authored copy is
re-applied over the manifest on every load, so captions, descriptions and alt text change
without re-hitting the API.

## Before this goes live

Three things are placeholders, and all three are deliberate:

**1. The photographs.** The tourism system above owns every image slot, including the
eleven on the five original pages — each is marked with `data-tourism="uganda/<category>"`
and takes its photograph automatically on the next `tourism:build-pages` once that slot
resolves. Until then those five pages keep their labelled SVG placeholders (they carry
their CSS inline and do not link the tourism stylesheet), and the generated destination
pages show pending plates that reserve the exact box the photograph will occupy.
`npm run tourism:validate` reports both states, so nothing goes live unnoticed.

**2. The contact details.** Phone numbers, addresses, opening hours, licence numbers and
the trails@pearltrails.co.ug address are illustrative. Search the HTML and replace them.

**3. The enquiry form.** A static site cannot receive a form submission, so the form
composes a pre-filled email to trails@pearltrails.co.ug and opens the visitor's mail app. It does not
post anywhere and it never claims a message was delivered when it wasn't. To take real
submissions, point the form at a service (Formspree, Basin, a Vercel function) and
replace the submit handler at the bottom of each page.

Prices, itineraries and figures are illustrative too. Check them before publishing.

## The fixed-window bands

The home page has two **fixed-window bands**, and each generated destination page has
three: the photograph locks to the viewport and the section travels across it like a
window. It is CSS only, no JavaScript. Below 1000px the picture stops being fixed
altogether rather than shipping a second image for mobile.

The construction is fragile in one specific way. The section clips its own fixed child
with `clip-path: inset(0)`, but the section must never become that child's *containing
block* — so **do not add `transform`, `filter`, `backdrop-filter`, `perspective`,
`will-change` or `contain`** to `.band`, to the picture, or to anything between them and
`<html>`. Any one of those turns `fixed` into `absolute`: the photograph starts scrolling
with the page, nothing errors, and the effect is silently gone. `background-attachment:
fixed` is not a substitute — iOS Safari ignores it.

`npm run lint` enforces this: it parses every CSS rule whose selector sits on the chain
down to the fixed picture and fails if one of those properties appears.

The scrim lives inside the picture, not on the band, and is a tint rather than a
blackout, so the photograph keeps its own light.

## Origin

Generated from the `tour-pearltrails01` master (style: `equatorial-fieldbook`) in the
[Architect-AI](https://github.com/ICOFCUCAM/Architect-AI) master library, then extracted
as a standalone site. The design is a field notebook and permit ledger rather than a safari brochure: papyrus stock, forest ink, no serif, day-numbered itinerary rows and monospace figures.
