# Production atmosphere artwork

This is the preparation workflow for eight reusable scene assets on `theme-update`.
The [current design](../current/README.md), [shared visual language](../current/visual-language.md)
and [appearance policy](../current/appearance-policy.md) govern their use. All eight
R3 references supply scene and palette identities; the [owner's style correction](style-decision.md)
directs a more abstract production treatment. Accepted screenshots remain intact.
Task status belongs only in [the backlog](../../backlog.md).

## Ordered scene queue

Generate and review one asset at a time in this order. Each Dark variant keeps its
Light partner's scene identity and composition, with the corresponding R3 treatment.

| Order | Asset ID | Scene/palette reference | Scene identity |
|---|---|---|---|
| 1 | `sunrise-light` | [R3-01](../remilo-r3-atmospheres/01-sunrise-light.png) | Warm peach/gold dawn, rising sun, mountain lake and pine-lined banks. |
| 2 | `sunrise-dark` | [R3-02](../remilo-r3-atmospheres/02-sunrise-dark.png) | Same dawn landscape with subdued warm Dark treatment. |
| 3 | `sky-light` | [R3-03](../remilo-r3-atmospheres/03-sky-light.png) | Clear blue daytime sky, clouds, mountain lake and green banks. |
| 4 | `sky-dark` | [R3-04](../remilo-r3-atmospheres/04-sky-dark.png) | Same daytime cloud/lake landscape with quieter blue-slate treatment. |
| 5 | `evening-light` | [R3-05](../remilo-r3-atmospheres/05-evening-light.png) | Rose/plum sunset, visible sun, mountain lake and banks. |
| 6 | `evening-dark` | [R3-06](../remilo-r3-atmospheres/06-evening-dark.png) | Same sunset landscape with subdued plum Dark treatment. |
| 7 | `night-light` | [R3-07](../remilo-r3-atmospheres/07-night-light.png) | Crescent moon, stars and moonlit mountain lake with icy-blue treatment. |
| 8 | `night-dark` | [R3-08](../remilo-r3-atmospheres/08-night-dark.png) | Same moonlit landscape with navy Dark treatment. |

Candidates contain scenery only: no wordmark, text, status bar, controls, category
badge, device frame or baked-in reading plane. Keep the accepted illustrated lake
and mountain family with the owner's more abstract treatment: broad layered
mountains, simpler conifer silhouettes, smooth water and minimal texture. Use both
[owner boards](style-decision.md#reference-use) and the current Night reference for
restrained silhouettes/depth while preserving each queued scene's identity and
palette. The boards' UI labels, time bands and navigation are not adopted. The
eight-item queue remains unchanged; Sky Dark remains daytime and Evening retains
its sunset sun. This style direction does not approve any generated candidate.

## Output and crop contract

- Approved master: **2048 × 1152**, **16:9**, opaque **sRGB PNG**.
- Runtime derivative: **1440 × 810**, **16:9**, opaque **lossless sRGB WebP**. RN and native
  exports use identical bytes from the approved master and recorded export settings.
- Review a hero opening at **360 × 200 dp** and a compact full opening at
  **360 × 96 dp**, including its **56 dp toolbar**. The exposed approximately 40 dp
  scenic strip is part of that full opening, not a separately generated image.
- Record one shared focal/crop policy for both RN and native use. Preserve an
  atmosphere cue and the mountain/lake horizon in the compact preview; reserve
  quiet, contrast-protected toolbar space. Do not stretch the landscape or redraw
  it for each screen. Reduce decoration first when text or usable height requires it.
- Keep artwork separate from opaque reading surfaces and semantic color tokens.
  Candidate approval does not establish actual text/control contrast.

Approved sources are preserved at their actual returned dimensions, with each
owner decision and file identity recorded in the [asset index](manifest.json) and
individual approval records. The selected sources so far are **1672 × 941**; each
has a downsampled 1440 × 810 derivative and an identical native copy. The nominal
2048 × 1152 target remains unmet and is recorded separately from artwork approval;
no enlargement, resolution-contract amendment or full dimensional acceptance is
claimed. Preserve source pixels and report this distinction for each later selected
candidate too.

The [original v1 scenery validation](records/scenery-validation-v1.json) retains
the earlier eight-source/export checks and 32 synthetic runtime crops. The
[current selection validation](records/scenery-validation-v2.json) records the
eight active assets after the approved Night pair replacement, verifies their
24 production files and checks both new Night runtime crop sets.
Night uses a raised compact focal to retain the full crescent at 360/412 dp; its
412 dp crop retains only a thin lake horizon. Wider shallow openings and expanded
toolbars require component framing checks. Packaged offline/pre-unlock appearance
and measured text/control contrast are subsequent implementation evidence.

Owner-directed revisions use separate candidate records and versioned production
files after approval. The [Night Dark blue-moon brief](night-dark-blue-moon-exploration.md)
records that exploration; the existing approved version remains the active registry
entry until an explicit adoption decision. The exact registry from the original
eight-scene validation is retained in [its snapshot](scenery-manifest-v1.json).
The subsequent [distant-shore-light request](night-shoreline-lights-revision.md)
extends the revision to both Night variants, with separate approval and preserved
version history.

## Approved Night asset selection

The active [registry](manifest.json) selects the approved v2 Night pair. Use each
entry's `approvedMaster`, `runtimeExport`, `nativeExport` and recorded crop policy
for subsequent implementation. Earlier versions remain preserved as provenance
alongside their separate approvals and the original registry snapshot.

| Night variant | Approved master | Runtime derivative | Scenic cues |
|---|---|---|---|
| Light v2 | [PNG](../../../assets/atmospheres/masters/night-light-v2.png) | [WebP](../../../assets/atmospheres/night-light-v2.webp) | Cream crescent, softer blue night layers, distant amber shore lights. |
| Dark v2 | [PNG](../../../assets/atmospheres/masters/night-dark-v2.png) | [WebP](../../../assets/atmospheres/night-dark-v2.webp) | Icy-blue crescent, deeper navy layers, matching distant amber shore lights. |

Native resource copies have the same bytes as these runtime WebPs. The
[Light decision](approvals/night-light-v2.json) and
[Dark decision](approvals/night-dark-v2.json) preserve each explicit approval,
original source identity, export settings and prior v1 files/decision. The
master resolution limitation above remains separate from the approved selection.

## Storage, evidence and explicit approval

| Artifact | Convention |
|---|---|
| Candidate returned for review | `verification/local/artwork/{id}/candidate-01.png` |
| Crop review and local validation | `verification/local/artwork/{id}/review.png` and `validation.json` |
| Exact generation prompt | `docs/design/production-assets/prompts/{id}/candidate-01.txt` |
| Generation/review record | `docs/design/production-assets/records/{id}/candidate-01.json` |
| Asset index | `docs/design/production-assets/manifest.json` |
| Approved master | `assets/atmospheres/masters/{id}-v{version}.png` |
| Approved RN derivative | `assets/atmospheres/{id}-v{version}.webp` |
| Approved native derivative | `modules/remilo-alarm/android/src/main/res/drawable-nodpi/remilo_scene_{atmosphere}_{brightness}_v{version}.webp` |

Candidate revisions increment `candidate-01` without overwriting earlier evidence.
Records retain the prompt reference, exact input reference paths/hashes, returned
candidate hash and actual dimensions, crop metadata, validation results and an
initially null approval. Record only observed results and the owner's actual
decision. Production revisions increment the `v1` suffix when an approved asset is
later replaced; accepted reference bundles are never edited.

Tracked resources use `path`. Ignored review artifacts use `localArtifactPath`
with their hashes as provenance, rather than portable live resource links. They
remain local to the generating checkout; a clean checkout need not contain
unapproved candidates or previews. Only approved production files become durable
asset inputs.

For each queued ID: save the candidate and generation evidence, validate its
format, show the image with hero/compact crop previews, and wait for explicit
owner approval. A requested correction produces another candidate for the same
ID. Approval of a screenshot reference or this workflow is not approval of a new
candidate. After approval, store the production master, deterministic derivatives
and recorded approval **before generating the next ID**. Unapproved candidates
remain under ignored `verification/local`; they are not production assets.

## Follow-up boundaries

After the eight scenes, prepare [static Classic exports](../../plans/redesign/td-05-static-branding.md)
from the [exact supplied crop](../../../assets/brand/reference/icon-classic.png) and
[source board](../../../assets/brand/reference/source-icon-board.png). Preserve
ring/check/sun geometry and finish through deterministic isolation, padding,
masks and exports; **no generative redraw**. Review launcher/adaptive/monochrome,
splash and notification outputs separately. Ordinary controls and structural
icons use code/vector assets rather than ImageGen.

The [Classic export briefs](classic-exports.md) define the deterministic preparation,
individual review order and storage conventions; the [brand registry](brand-manifest.json)
preserves source hashes and explicit export approvals alongside the scene registry.

R9 Completed/Trash/Activity remains draft and is not part of this production-asset
queue. Decorative list icons remain provisional, with omission preferred until
the owner resolves the decision. No task-specific scenes, per-reminder appearance,
dynamic launcher variants, Calendar/cloud or iOS assets enter this work.

Artwork preparation does not complete TD-01–TD-06, change runtime/build code or
pass physical gates. Actual RN/Compose crops, token contrast, large text/TalkBack,
IME behavior, native session/privacy handling and signed-device observations remain
part of the [existing verification contract](../../verification.md) and consolidated
owner acceptance run.
