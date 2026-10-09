# TD-01 evidence — shared foundations

Recorded 9 October 2026 from the uncommitted implementation workspace on
`theme-update`, based on HEAD `1d62f6b1bba81241120c4f31e600a3d7bbce0ae3`.
That revision identifies the starting point, not a committed redesign or the
source of an APK. This handoff records delivered source, focused host checks and
the inspected fixture captures. Live task status belongs only in
[backlog](../backlog.md).

## Scope and design authority

After these checks, the asset integration was committed as `39212f8` and shared
foundations as `9d73dd8` on `theme-update`. The complete source sequence and
build relationship are recorded in [TD-06](redesign-td-06.md#subsequent-source-commits).

The [TD-01 plan](../plans/redesign/td-01-shared-foundations.md),
[current design](../design/current/README.md),
[visual language](../design/current/visual-language.md),
[appearance policy](../design/current/appearance-policy.md),
[product](../product.md), [architecture](../architecture.md) and
[implementation decisions](../design/current/implementation-decisions.md) govern
the implementation. All eight accepted R3 images, recorded under A18, govern the
shared visual language. Later approved page contracts and maintained corrections
govern structure and behavior. A36 fixes the four-atmosphere policy; A37 preserves
reference bundles and historical decisions while removing obsolete material.

The owner fixed icon-free Lists, one neutral `event` glyph for reminder rows and
details, deferred semantic categories, skipped-state Reopen correction and the
complete static Classic export set. Those requirements are recorded in current
contracts without rewriting historical approval/submission records. R9 is
approved for implementation through the owner's
[composition 05 decision](../design/r9-runtime-composition-approval-v5.json) after
four rejected compositions. That decision is separate from the shared role
checks below. Classic artwork approvals
and integration are recorded in [TD-05](redesign-td-05.md).

## Canonical roles, geometry and crops

| Source | Delivered interface |
|---|---|
| [presentation.json](../../assets/atmospheres/presentation.json) | Canonical eight-pair colors, role aliases, header contrast treatment, typography, spacing, shape, target sizes, explicit asset names and approved hero/compact focal coordinates. |
| [presentation.mjs](../../scripts/presentation.mjs) | Deterministic TypeScript/Kotlin generation; `--check` compares existing files without writing or producing artwork. |
| [atmosphere.generated.ts](../../src/ui/atmosphere.generated.ts), [AtmosphereTokens.kt](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/AtmosphereTokens.kt) | Matching RN/native constants generated from the canonical JSON. Kotlin includes bundled drawable names, role colors, scrim alpha and focal coordinates. |
| [colors.ts](../../src/ui/colors.ts), [tokens.ts](../../src/ui/tokens.ts), [theme.tsx](../../src/ui/theme.tsx) | Map generated roles into shared components and expose resolved global atmosphere/brightness. Preference resolution, holds and persistence evidence belongs in [TD-02](redesign-td-02.md). |

Each pair defines canvas, opaque elevated surface, neutral primary/supporting
content, primary/onPrimary, selected container and outline. Shared aliases add
focus, selected content, primary/secondary pressed roles and destructive action
roles. Light/Dark semantic groups define error, warning, success, disabled
surface/content and inverse feedback/action roles. Reading planes are opaque;
scene artwork remains decorative and cannot select reminder semantics.

The canonical geometry specifies a 200 dp home opening, 96 dp secondary opening
including the 56 dp toolbar, 16 dp gutters/corners, 48 dp ordinary target minimum,
56 dp prominent app action minimum and native single/member minima of 64/56 dp.
Typography is display 32, title 24, app bar 22, heading 18, body 16 and supporting/
label 14 sp. Spacing is 4/8/12/16/24/32 dp; fields, groups and actions use 16 dp
corners and sheets use 24 dp corners. Actual font scaling and constrained windows
may grow content and chrome. Decoration shrinks first: the shared header reduces
to toolbar height below 480 dp window height or at a font scale of at least 1.6.

All eight runtime/native scenes consume the active production registry versions:

| Pair | Approval record and consumed derivative |
|---|---|
| Sunrise Light | [v1 approval](../design/production-assets/approvals/sunrise-light-v1.json); `sunrise-light-v1.webp` |
| Sunrise Dark | [v1 approval](../design/production-assets/approvals/sunrise-dark-v1.json); `sunrise-dark-v1.webp` |
| Sky Light | [v1 approval](../design/production-assets/approvals/sky-light-v1.json); `sky-light-v1.webp` |
| Sky Dark | [v1 approval](../design/production-assets/approvals/sky-dark-v1.json); `sky-dark-v1.webp` |
| Evening Light | [v1 approval](../design/production-assets/approvals/evening-light-v1.json); `evening-light-v1.webp` |
| Evening Dark | [v1 approval](../design/production-assets/approvals/evening-dark-v1.json); `evening-dark-v1.webp` |
| Night Light | [v2 approval](../design/production-assets/approvals/night-light-v2.json); `night-light-v2.webp` |
| Night Dark | [v2 approval](../design/production-assets/approvals/night-dark-v2.json); `night-dark-v2.webp` |

The [asset registry](../design/production-assets/manifest.json) records provenance,
approval hashes and derivative geometry. Every active scene uses the 1440×810
runtime export and a byte-identical native drawable-nodpi export. Hero focal
coordinates are `[0.5, 0.500534]`; ordinary compact coordinates are
`[0.5, 0.460321]`; Night v2 uses the raised compact crop `[0.5, 0.430160]`.
Cover sizing uses the measured header bounds and clamps the focal offset to the
image extent. Historical Night v1 resources are preserved but are not selected by
the active mapping.

Sunrise/Sky/Evening Light headers use dark `#172331` content with a white scrim;
the other five pairs use white content with a black scrim. The 0.54-alpha scrim
maintains a plateau through measured chrome and then fades into the scene.
Header text and ordinary resting icon targets have transparent backgrounds.
Reading cards and footers use opaque role surfaces. Artwork failure retains the
usable header and controls; native scheduling/promotion must not depend on
decoding artwork, as recorded in [TD-04](redesign-td-04.md).

## Shared components and input geometry

[components.tsx](../../src/ui/components.tsx) supplies shared scenic page headers,
cards, grouped settings rows, fields, outlined secondary actions, neutral Cancel,
primary/destructive actions, radios, switches, disclosures, sheets, query states,
status/action feedback and bottom action bars. Button labels wrap with no reserved
empty icon slot; optional icons precede labels horizontally. Icon-only targets
have action labels and 48 dp minimum bounds. Switches use a 52×32 dp track and
24/20 dp selected/unselected thumb within a full labeled row target. Radio choices
retain native/web checked semantics. Decorative icons/art are excluded from the
accessibility tree; required state is also conveyed by text/roles.

[FormViewport](../../src/ui/form-viewport.tsx) separates scrollable content from a
measured footer sibling. It reserves safe-area/residual IME space once, restores
destination scroll when ready and reveals focused/helper/error ranges.
[Field](../../src/ui/components.tsx) responds to focus, validation and multiline
growth. The Android own-window geometry observer supplies native caret/viewport
rectangles and opaque field identity without text/composition content. Native
`adjustResize` remains authoritative; RN applies only observed residual overlap.
Its native policy and input-workflow checks are documented in TD-03/TD-04, not
inferred from the static captures here.

[motion.ts](../../src/ui/motion.ts) observes the OS reduced-motion preference;
sheet entrance becomes immediate and programmatic form reveals avoid animated
scrolling when reduced motion is enabled. The fixture override remains
presentation-only. Actual Android accessibility, reduced-motion and composing
text observations remain pending.

## Implementation-aware design verification

[verify-design.mjs](../../scripts/verify-design.mjs) retains the frozen cleanup
audit's accepted-reference hashes, historical decisions/citations, obsolete-file
removal manifest, galleries, JSON and local-link checks. It allows authorized
runtime/contracts/backlog edits instead of enforcing the cleanup-era runtime
freeze. The immutable baseline remains historical evidence; its protected
reference/decision subset is still checked.

The active verifier additionally checks individual scene/brand approval records
and approved hashes, complete eight-pair coverage, confined repository asset
paths, image container/dimensions, runtime/native byte equality, explicit active
asset bindings, all 16 approved crop bindings and deterministic TS/Kotlin output.
Current resource references resolve from the implementation root; frozen host
paths and removed historical citations retain their provenance handling. No
historical approval hash is regenerated to conceal a change.

## Actual focused host and fixture evidence

The following read-only focused checks were executed on 9 October 2026 while
writing this handoff. They do not replace the integrator's full sequential release
preparation or establish source attribution for an APK.

| Command | Observed result |
|---|---|
| `node scripts/presentation.mjs --check` | Exit 0: RN/native presentation constants match the canonical roles/crops. |
| `npx.cmd vitest run src/domain/contrast.test.ts` | Exit 0, one file and 5/5 tests passed; reported start 09:27:35, test duration 341 ms. |
| `node scripts/verify-design.mjs` | Exit 0, zero findings. Protected 245 reference/decision files; 166 editable runtime baseline files; 8 approved scenes/24 scene files/8 identical native copies; 6 approved Classic exports/34 files/37 identical copies; 8 presentation pairs/16 crop bindings/2 generated files; 90 implementation-root references. |

Contrast tests evaluate actual generated role colors with the sRGB relative
luminance calculation across all eight pairs. Primary/supporting/status text on
canvas, surface and selected containers passes 4.5:1; onPrimary, disabled and
inverse feedback/action pairs pass 4.5:1; required outline graphics pass 3:1.
An additional read-only calculation over those same canonical values measured:

| Tested category | Minimum ratio | Limiting pair |
|---|---:|---|
| Reading/action/status ink on reading planes | 5.24:1 | Sunrise Light primary on container |
| Filled, disabled and inverse action/content pairs | 6.02:1 | Light disabled content on disabled surface |
| Outline on elevated surface | 3.56:1 | Night Light |
| Header text at the limiting composited RGB endpoint | 4.60:1 | Dark header ink over white 0.54-alpha scrim on black |

The header test bounds all RGB scene pixels under the constant-alpha plateau;
it does not sample only favorable artwork pixels. Correct placement of every
actual control within that plateau, OS-rendered glyphs and anti-aliasing still
require runtime observations. Passing token calculations alone does not certify
TalkBack, actual target reachability or every page layout.

The integrator captured actual ordinary RN web-fixture Appearance pages at
360×800 for all eight pairs. Individual private captures are
`verification/local/ui-redesign/final-{sunrise,sky,evening,night}-{light,dark}.jpg`.
The inspected private review board is
`verification/local/ui-redesign/final-eight-pair-review.png` (1116×1300), SHA-256
`34d5abe5d1ca3bf93ba46bf0c9652db016fd77f9c257761659c735988ca5c1b7`.
It arranges uniformly resized screenshots, with the four Light pages above the
four Dark pages; it is not generated concept art. Inspection shows consistent
radio/row/card typography, opaque reading planes, transparent scenic chrome and
the raised Night v2 compact landmark. Supporting content scrolls normally; the
browser scrollbar is present in the fixture. No content/control overlap was
visible in these captured states.

These captures exercise the isolated, memory-only fixture bridge and current
shared components. They cannot deliver native alarms or read durable reminder
state. They are not native Compose renders, 200% text/IME evidence or owner
acceptance of R9. Longer text, errors, uncertain operations and additional pages
are recorded separately by the integrator in TD-03/TD-06 when actually observed.

## Limitations and remaining acceptance

The verifier reports all eight preserved masters at **1672×941**, below the
recorded **2048×1152** source target. The approved pixels and 1440×810 derivatives
are consumed without claiming new source detail or quietly replacing approvals.
Artwork approval, technical conformance, fixture review and physical runtime
acceptance remain distinct.

This focused work ran no native compilation, release assembly, signing,
installation or distribution. Append actual final shared/native/lint/signed
artifact evidence in TD-06 after the integrator's single sequential
`npm run release:prepare` workflow; do not infer that outcome here.

The consolidated [owner run](../device-acceptance.md) still must observe:

- Actual RN and native rendering of all eight pairs, hero/compact crops and
  constrained windows, long English/Chinese and 200% system text.
- Ordinary/prominent/native target reachability, real contrast/focus/state
  graphics, TalkBack order/labels/checked state and OS reduced-motion behavior.
- Lower Notes insertion point, multiline growth, composition/selection,
  validation context, taller/emoji keyboards, first-tap Save, Back, rotation and
  lifecycle changes with the actual own-window geometry observer.
- Loading, retained errors and unconfirmed operations without lost drafts,
  inputs, focus or scroll; shared sheets and system picker/share flows.
- Native alarm privacy, frozen presentation, artwork failure and persistent
  controls alongside the existing G1/G2/G3 scheduling/recurrence/recovery gates.
- Static Classic OEM masks, actual notification/system branding and splash
  behavior, separately from the six individually approved export artworks.

The owner deferred interactive phone testing until this consolidated run. That
allows implementation to proceed while physical gates remain unobserved; it
does not establish a verified beta or authorize distribution. The owner separately
closed R9 composition review through the recorded composition 05 approval; that
decision does not pass physical gates.
