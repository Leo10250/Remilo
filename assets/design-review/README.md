# Appearance review assets

These assets belong to the non-shipping iteration-0 comparison. The Android
production launcher/splash/notification exports are not replaced by this folder.

## Supplied identity

`source-icon-board.png` is the owner's supplied Remilo board. `icon-classic.png`
is its large Classic icon: left 491, top 68, width 467, height 467. The decoded
crop pixels are unchanged. The blue/violet ring, white check medallion, orange
sun and dimensional finish are the requested identity, not a new interpretation.
The original board and crop are retained for side-by-side fidelity review.

The other seven `icon-*.png` color variants use deterministic per-pixel hue
mapping, preserving geometry, shading and alpha. They are candidates, not final
launcher exports. Mist uses luminance conversion. No generative redraw of the
symbol was used.

`icon-adaptive-foreground.png` uses a coarse source-pixel isolation mask. The
circle/squircle/rounded samples demonstrate safe-area sizing only. Clean layer
separation, edge treatment and final Android masks still require foundation
review. `icon-monochrome.png` is a purpose-built silhouette candidate displayed
on a sample system color, not a claim that Android themed icons follow Remilo's
palette. `icon-review.png` includes the source crop, variants and actual 48px
samples. The 467px source limits detail; resizing cannot create original detail.

## Generated scenery

The two transparent static illustrations were generated with the built-in
`image_gen` tool, inspected, then copied into this workspace. Alpha is preserved.
They contain no text, UI or private reminder content.

Landscape prompt:

> Use case: stylized-concept. Create a bundled static landscape for a calm
> reminder application. Wide transparent illustration with softly layered hills,
> a small warm rising sun partly behind the hills, subtle clouds and a few
> botanical silhouettes at the edges. Refined rounded paper / soft-clay
> dimensional treatment. Pale blue, mint, honey, lilac and restrained coral.
> Keep the scene in the lower half, with generous empty transparent space above.
> No text, logo, mock device, border, card, UI, stars, glitter, bokeh, orbs or
> blur. Crisp, restrained shapes. The sun is integrated into the horizon.

Botanical prompt:

> Use case: stylized-concept. Create one bundled static botanical illustration
> for a Nature reminder detail and native alarm. An elegant sprig with five
> rounded leaves on a curved stem, resting on a small mound. Refined soft-clay /
> folded-paper dimensional style, smooth contours and natural shading. Sage and
> mint with a tiny honey highlight. Centered on a transparent background with
> generous empty space. No pot, text, logo, frame, card, device, UI, sparkles,
> particles, bokeh, orbs, cast background or busy objects. Crisp subtle depth,
> real alpha transparency.

Everyday artwork is low-emphasis. Essential text/controls use reviewed opaque
roles; richer isolated artwork must yield to content and large text. These two
compositions establish the review direction, not the full production art catalog.

## Reproduction

With Node 22.23.x and Sharp available (pass its package directory when it is not
locally resolvable):

```sh
node --experimental-strip-types scripts/design-review-assets.mjs [sharp-package-path]
node --experimental-strip-types scripts/verify-design-review-assets.mjs [sharp-package-path]
```

The exporter creates color/mask boards and debug-only Android drawable copies,
then exports the exact TypeScript candidate catalog to native JSON. The checker
is read-only: it verifies source hash, decoded Classic crop equality, usable
alpha/nonblank imagery, sizes and native pixel/token parity. `manifest.json`
records source/export parameters. It does not prove rendered contrast,
launcher caching, device behavior or owner approval.
