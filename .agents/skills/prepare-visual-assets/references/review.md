# Technical and visual review

## Measure before transformation

Read source dimensions, encoded format, mode, alpha coverage, EXIF orientation and embedded color profile before converting pixels for preview. Report encoded and orientation-normalized dimensions separately when they differ. A requested dimension, `.png` suffix or RGB mode does not establish exact size, format or sRGB conformance.

Retain original bytes. Distinguish tagged sRGB, an actual conversion from a known profile and an explicitly documented interpretation of untagged pixels. Do not attach a profile and claim that a color conversion occurred. Unknown profile treatment remains a limitation or failed configured check.

Validate exact-size versus minimum-size requirements as configured. Do not silently enlarge a small output. Regenerate or disclose the deficiency. A separately permitted enlarged launcher configuration export must record interpolation and that no source detail was added. Derive smaller sizes from the source/prepared source, not from that enlargement.

Inspect the actual decoded staged export alongside the original. “Lossless WebP” means encoding preserves the transformed pixels; it does not mean a resized derivative equals the untouched source. Verify every channel, including RGB differences when alpha is unchanged. Verify required copies by byte hash, not just decoded similarity.

## Framing and crop feasibility

Use aspect-preserving `cover`, `contain` or unchanged-size views. Never distort a comparison thumbnail to fit a rectangle. Focal coordinates are normalized within the current image and must lie in `[0,1]`; landmark bounds use `[x0,y0,x1,y1]` with increasing edges.

For a `cover` viewport, compute the source crop at the viewport aspect ratio and clamp its center to the source. Compare each landmark's padded bounds with that window. Distinguish:

- Fits at the selected focal point.
- Could fit at another focal point.
- Cannot fit because the combined required bounds exceed the window.

A feasibility result is geometry, not semantic recognition. Agents must inspect that the declared landmark bounds actually describe the intended cue. Do not use asset-specific yellow-pixel or star-count heuristics as universal detectors.

After export trimming/resizing, map focal points and landmarks from source coordinates to the derivative's coordinates. Do not reuse normalized coordinates blindly when the source rectangle changed. Record both transforms.

Render every representative viewport required by the brief. A compact header includes its full toolbar opening; it is not just the exposed strip below the toolbar. Mark overlays with simple review boundaries. These boundaries show obscured areas but do not prove text contrast or an actual screen implementation.

For Remilo, broad openings are `360/412 × 200 dp`; compact openings are `360/412 × 96 dp`, including the 56 dp toolbar. Review the master and 1440 × 810 decoded runtime image. Wide shallow openings can make preserving the complete crescent plus distant shore impossible; flag this rather than silently dropping one cue. Use the project's profile for precise focal values.

## Applicable preview modes

| Asset | Useful previews |
|---|---|
| Scene/hero | Full art, reference comparison, broad and shallow crops, overlay space, paired illumination variants. |
| Transparent artwork | Contrasting dark/light surfaces, checkerboard, actual scale and edge magnification. |
| Launcher/branding raster | Source comparison, actual small sizes, circle/squircle diagnostics and supplied adaptive masks/safe areas. |
| Manual vector brand mark | Native/vector rasterization at intended size and contrasting surfaces; raster CLI does not construct it. |

Mask previews are diagnostics. A circle or approximate squircle is not a claim about every Android OEM launcher. Do not present a flattened tile as an isolated adaptive foreground. Missing layered sources require faithful manual preparation and another review.

Portable fonts must fall back to Pillow defaults or an available host font. Font selection cannot block image QA. Labels identify the source, view dimensions, crop policy and any transformation. Avoid decorative UI mockups that could be mistaken for implementation evidence.

## Visual findings

Use direct inspection for the following relevant checks:

- Scene/subject identity and intended level of abstraction.
- Landmark positions, framing and continuity between related variants.
- Requested moon/sun/cloud/detail visibility in each crop, including overlay occlusion.
- Unwanted text, interface remnants, device boundaries, branding or watermarks.
- Edges, alpha halos, clipped contours, gradient banding and visible compression issues.
- Foreground/mountain layer separation; avoid claiming “not crushed” solely from histogram values.
- Branding proportions, faithful finish and recognition at actual small sizes.

Record `pass`, `fail` or `pending` with an observation and the reviewed image identity. A script-generated preview or histogram alone cannot set these visual checks to pass. Inspection can be performed by the main agent or a delegated reviewer; neither replaces human approval.

For a consequential revision or multi-variant set, use two review responsibilities: file/export/provenance correctness and visual/application framing. Independent agents can reduce confirmation bias when available; the main agent must complete both if delegation fails. Do not demand two agents for every minor edit.

## What remains outside synthetic review

Do not claim measured text/control contrast, accessibility, actual RN/native component crops, offline/pre-unlock packaging, installed icon behavior or physical-device acceptance from these previews. Run relevant project checks separately and report their real scope. Remilo's `verify:design` validates protected references and document resources; it does not establish arbitrary image hashes, visual correctness or device behavior.
