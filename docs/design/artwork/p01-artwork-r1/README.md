# P01 artwork-only candidates — r1

Four standalone sources generated under the bounded [A12 r2 approval](../../p01-style-r2-acceptance.json).
**All candidates remain unapproved.** The original references are the primary quality targets.
Review the [comparison board](../../p01-artwork-review-r1.html), [manifest](../../p01-artwork-r1.json)
and [evidence](../../../evidence/2026-10-06-p01-artwork.md). No consuming application code or
Android drawable export is added. These are review sources, not a theme catalog.

## Candidates and artistic assessment

| ID / original | Composition and similarity | Integration suitability / limitations |
|---|---|---|
| [M1 — airy canopy](meadow-m1-canopy.png) | Broad rounded asymmetric leaves form overlapping left/right/upper clusters; soft mint/sage gradients and a quiet central opening. Balanced environmental framing is closer to the desired botanical reference than the rejected centered sprig. | Recommended Meadow starting source. Larger/denser leaves and stronger veins than the low-resolution reference; detailed side regions must clear long titles. |
| [M2 — garden edge](meadow-m2-garden.png) | Taller right-hand sweep with a diagonal rhythm and pale distant foliage. Same shared illustration vocabulary; slightly more open upper center, less symmetric mass distribution. | Good alternative if the stronger right-hand framing is preferred. The right-side mass descends farther, increasing crop/title-clearance risk. |
| [S1 — open horizon](sunrise-s1-horizon.png) | Cream/honey/peach rolling layers, simple clouds and a partly occluded sun with gentle rays. Strongest link to the original Morning landscape's simple warmth. | Recommended Agenda starting source; quieter foreground. Fuller cloud groups than the reference must not compete with reminder surfaces. |
| [S2 — leafy edges](sunrise-s2-edge-garden.png) | Sweeping warm hills, smaller rayless sun and sage foreground corners. Connects the Butter editor's integrated scenery to Meadow's plant vocabulary. | Richer alternative; leaves are larger/grayer than the reference's delicate plants and can crowd the Add region. Needs careful crop and opaque reading/control regions. |

These are qualitative assessments, not owner acceptance or numerical visual-similarity
scores. All four avoid generated UI/text/logo and the glossy isolated object composition.
Gradient translucency and relative saturation must be judged over the intended canvas;
raw alpha viewers may display the transparent pixels as black. No background is painted
into the preserved originals to conceal alpha or alter the comparison.

## Generation and exact prompts

Built-in imagegen was used once for each requested candidate, with `transparent_background=true`.
The original image paths were passed as direct visual reference inputs; they were not edit
targets. Four outputs only; no retries, extra candidates, dark treatments, icons or catalog.

- [M1 prompt](meadow-m1-canopy-prompt.txt)
- [M2 prompt](meadow-m2-garden-prompt.txt)
- [S1 prompt](sunrise-s1-horizon-prompt.txt)
- [S2 prompt](sunrise-s2-edge-garden-prompt.txt)

Meadow inputs, in tool order: [desired Water plants](../../references/desired-water-plants-reference.png),
[time/alarms board](../../references/time-of-day-and-alarms.png),
[original Butter/Periwinkle/Sage](../../references/butter-periwinkle-sage.png).
Sunrise inputs: the time/alarms board, then original Butter/Periwinkle/Sage.
Prompts explicitly identify the relevant foliage/landscape regions and exclude all UI.
The isolated sprig/3D object examples elsewhere on the boards were explicitly excluded
as composition targets. Original Classic identity was neither used nor regenerated.

Source files are 1024×1536 Meadow / 1536×1024 Sunrise RGBA PNG, copied byte-for-byte from
the returned imagegen paths into this tracked review directory. Original generated files
remain in place. Source hashes, exact tool-request prompt hashes, input-reference hashes,
alpha statistics and the reconciled clean starting commit are in the manifest.
1440 px bounded runtime export is intentionally deferred until selected-art approval.

## Composition and crop constraints to carry forward

- Meadow: shared top-center anchor `(0.5, 0.0)`; environment covers upper and side regions.
  The central lower third is essentially empty alpha. Edge foliage is not an essential
  text-safe guarantee; use measured real title/time/action bounds at the integration gate.
- Sunrise: bottom-center `(0.5, 1.0)`; broad horizon and sun remain in the selected crop.
  Upper source space is transparent. Visible terrain occupies the lower source region;
  fitting the full 1536×1024 source to 360 dp width gives a 360×240 layer, with less than
  240 dp of visible terrain. Reconcile exposed scene coverage through deliberate uniform
  scale/crop/placement, not stretched shapes or a mandatory empty Agenda panel.
- Native and RN must later consume matched source pixels/anchors. Selected dark treatment
  retains geometry, with renewed artwork review for material style/composition changes.
- No UI overlays, token choices, accessibility contrast or responsive layout have been
  accepted by the artwork source alone. Final actual-rendered-UI approval remains separate.

## Requested artwork decision

Recommendation: **M1 + S1** for balanced Meadow coverage and simpler Agenda foreground.
The owner may select either alternative or request a bounded revision. Record accepted
IDs/hashes and conditions before any UI integration. Both artwork and actual-render gates
remain pending; P01 is not complete. P02/production changes remain outside this stage.
