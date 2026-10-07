# P02 foundation contract — sample revision 1

The canonical [catalog](catalog.json) is `schemaVersion: 1`, `P02-sample-r1`.
This is the expansion sample, not the completed eight-environment catalog.
[A17](artwork-r1-acceptance.json) accepts SK1/RO1 sources; their rendered
treatments, colors and controls are submitted in [the sample board](sample-review-r1.html).

The eight stable IDs are classic, sunrise, sky, meadow, peach, rose, lavender,
and mist. This revision supplies Sunrise/Meadow anchors, Sky/Rose, and an
undecorated Classic emergency baseline. Classic scenery and Peach/Lavender/Mist
are deliberately absent until sample acceptance. Reserved IDs resolve to Classic
in this partial catalog. No saved appearance policy is implemented.

## Shared values and interfaces

System typography uses 28/22/18/16/14/12 sp display, app-bar/time, heading,
body, supporting and minor roles, with approximately 1.4 line height. Timing,
delivery and errors use supporting or larger roles. Spacing is 4/8/12/16/24/32 dp;
phone gutters are 16 dp. Tile/group corners are 16 dp, field/action 12 dp,
sheet 24 dp. Targets are at least 48 dp; single native alarm actions retain 64 dp.

`lookupFoundation(id, resolvedBrightness)` returns only static rendering values.
TS and Kotlin carry brightness, palette IDs, color roles and placement values;
they acquire no preferences, engine, database, time policy or action controller.
Unknown IDs or malformed color roles resolve to Classic at the supplied brightness.
An invalid catalog uses the independent emergency colors. Requested artwork failure
uses a solid Classic fallback; an ordinary undecorated control is not failure.
These lookups never rewrite a requested choice or issue a mutation.

Every RN alias and all 36 Compose scheme roles are explicitly mapped in the source.
Pressed, focus, disabled, selected, inverse-feedback and destructive foreground
roles are explicit. Shared component props/callbacks remain compatible. Foundation
styling is an opt-in context; production and historical P01 providers remain on
their existing presentation. Tile rendering is an additive prop with row default.
No completion animation, callback ordering or action lifetime changes were added.

Controls retain font scaling and wrap/grow. Icons/progress reserve their space.
Foundation multiline inputs grow from their actual content-size events. Disabled
and busy actions retain explicit semantics and suppress dispatch. Sheet focus,
Back, retry and feedback timing keep their existing implementations; actual
Android observations remain in P12.

## Source and placement

Source dimensions, original hashes, export hashes and treatments are bound in the
[export manifest](export-manifest.json). New exports use bundled Sharp 0.35.4:
Lanczos3, no enlargement, PNG compression 9, no palette quantization. All are
at most 1440 px wide, two megapixels and 2 MiB each. Eight unique images total
7,415,492 bytes. RN and native PNG bytes are identical. Sample native scenery
is debug-only; RN asset imports enter only through the opt-in preview resolver.

Dark variants use separately recorded, intentional RGB multipliers on source
scenery, preserving alpha and geometry. They do not darken UI screenshots.
Quiet regions are normalized `[left, top, right, bottom]`; anchors are normalized
`[x, y]`. Both renderers apply the catalog's top/bottom crop anchors. Browsing
columns retain 560 dp and individual columns 480 dp limits. Artwork is a backdrop,
excluded from hit testing and semantics. It reserves no content space. Reading
surfaces remain opaque, including grouped headings and native loading/multiple
states. Layout height and scrolling come from content.

## Deterministic authoring and export

Material color utilities 0.4.0 is pinned as development tooling. Seeds, neutral/
accent chroma, tone assignments and anchor/baseline overrides are recorded in the
catalog; outputs are static. No runtime HCT import is shipped. The published HCT,
TonalPalette and string modules were used directly because the package's root
barrel loads unrelated extensionless scheme imports under Node ESM.

Use `node scripts/p02-export.mjs --export|--check [sharp-package-path]`.
`--check` reads only; it recomputes expected bytes and rejects stale/missing output.
`--help` describes the interface. Missing roles, malformed colors, duplicate IDs,
invalid normalized placements and absent inputs fail validation. The exporter
does not touch icon candidates or historical submissions.

Authoring sources: [Material package](https://github.com/material-foundation/material-color-utilities/blob/main/typescript/package.json),
[RN 0.86 TextInput](https://reactnative.dev/docs/0.86/textinput),
[RN 0.86 Pressable](https://reactnative.dev/docs/0.86/pressable), and the existing
[Expo 57 Symbols implementation](https://docs.expo.dev/versions/v57.0.0/sdk/symbols/).
The installed Compose 1.3.2 controls were compiled and rendered without upgrades.

## Subsequent gates

Sample acceptance precedes remaining source generation. Acceptance of those
sources precedes complete catalog integration. Complete catalog acceptance
precedes Classic production activation and attributed production comparisons.
The final eight-palette matrix and downstream handoff remain later P02 work.
Storage/operational/backup versions stay 4/3/3; installation and physical acceptance
are outside this checkpoint.
