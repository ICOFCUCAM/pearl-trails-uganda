# Generated reference images

Drop generated images here, named `<country>-<category>.<ext>`:

```
uganda-hero.png
uganda-wildlife.png
uganda-wildlife-2.png     alternates get a numeric suffix
kenya-culture.webp
```

`npm run tourism:review` picks them up automatically and shows each one beside
the ranked Unsplash and Pexels candidates for that slot.

## What these are for

**They are reference targets, not photographs.** The brief for each slot
(`npm run tourism:prompts`) describes the shot the site wants. Generating it
gives you something concrete to hold the stock candidates against: does this
Unsplash result actually show what we asked for, or is it merely nearby?

They also make a gap legible. When a slot stays unresolved after both
providers, the reference tells you whether the shot exists and stock simply
lacks it, or whether the brief itself was unreasonable.

## Before you consider publishing one

The resolver will not put a generated image into the manifest, and this is
deliberate. Before that changes, three things need answering — they are
editorial and legal questions, not technical ones:

**It is a tour operator's website.** A generated image of Bwindi is not a
photograph of Bwindi. A visitor reasonably reads a picture on a tourism page as
a record of the place they are being sold, and a synthetic one quietly is not.
That is the whole objection, and it does not go away by improving the model.

**People are the sharpest case.** The site's own brief asks for authentic,
country-specific cultural imagery and warns against making every African person
look interchangeable. A generated "Ugandan elder" depicts nobody, drawn from a
model whose idea of the region is assembled from whatever it was trained on.
The categories to keep synthetic images out of longest are `people`, `culture`,
`family`, `locallife`, `festivals` and `crafts`.

**Landscape and abstract slots are the weakest case against.** A generated
texture, a mist study, an unpeopled canopy — these carry far less claim about a
specific place, and are where a synthetic image does least harm if labelled.

If you do decide to publish any of these, the minimum is: a `synthetic: true`
flag on the record, a visible on-page label in place of the photographer
credit, and an audit rule that fails the build if either is missing. Say so,
and I will wire it up — the provider abstraction already has room for it.

## Not committed by default

`.gitignore` excludes the image files here (they are large and regenerable) but
keeps this README. Remove the ignore rule if you want them versioned.
