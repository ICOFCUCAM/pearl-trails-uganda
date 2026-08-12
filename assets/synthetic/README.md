# Publishable synthetic images

Committed, public, and served from this directory. Distinct from
`tourism/generated/`, which holds reference targets that are never published.

**Real photography is the default and the preference.** An image here is a
fallback, used only when both Unsplash and Pexels have failed for a slot the
policy has already cleared — and only 10 of the 405 slots can ever qualify.

## The contract

Two files, same stem, both required:

```
east-africa-scenic.webp
east-africa-scenic.json
```

The sidecar:

```json
{
  "generationPrompt": "Cinematic atmospheric interpretation of broad savanna and distant highlands, no recognisable location",
  "generationModel": "example-image-model-v3",
  "generatedAt": "2026-08-12T09:14:00Z",
  "width": 2400,
  "height": 1350,
  "dominantColor": "#2b3a2e"
}
```

An image without a complete sidecar is refused. So is a sidecar that sets
`photographer`, `photographerUrl`, `sourceUrl` or `provider` — a synthetic
image has none of those, and a sidecar claiming one is a misunderstanding worth
failing loudly on rather than silently dropping.

No CDN resizes these; the file is served exactly as committed. Export at the
slot's aspect ratio (`npm run tourism:prompts` states it) and at a sensible
width — 2400px for a parallax band.

## Which slots can use one

```sh
npm run tourism:synthetic-policy
```

Ten of 405, all `scenic` or `whyvisit`, none for a specific country's hero.
Three gates, all of which must pass, and none of which is inferred:

1. The category is in `SYNTHETIC_ALLOWED_CATEGORIES` — `hero`, `scenic`,
   `whyvisit` and nothing else.
2. A hero qualifies only for the region, never for a country. A country hero is
   the opening frame of a page selling that country: a specific destination
   claim.
3. The slot's subject names no recognisable place or species. `uganda/scenic`
   is an allowed *category* but names Ishasha and the Rwenzori, so it is
   refused. A named place beats the allowlist, always.

## What the visitor sees

Where a photograph shows `Photograph <name> · Unsplash`, a synthetic image
shows:

> **ILLUSTRATIVE** Illustrative image — not a photograph of the destination.

Same position, more prominent than a credit. The absence of a photographer is
never a silent absence.

## What fails the build

`npm run tourism:validate` errors — not warns — if a synthetic record credits a
photographer, carries a stock source URL or CDN path, is missing its disclosure
or any part of its generation record, has its four flags disagree, or sits in a
real-photography-only category. The path guard catches an image under
`/assets/synthetic/` even when the record claims `provider: "unsplash"` and
`synthetic: false`, so relabelling one does not get it through.

Empty of images by design. The system is ready; nothing has been generated.
