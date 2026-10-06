# P01 specification refinement — 6 October 2026

This is documentation/visual-audit evidence, not completed P01 implementation or
design acceptance. Live status is only in [backlog](../backlog.md).

## Source reconciliation and preservation

The checkout began clean on `theme-update`, HEAD and locally recorded
`origin/theme-update` both `4d1059c9ff2d7289a46b5c2047765b3865a2974b` (First iteration).
No network fetch is implied. That commit retains the prior r1 intake documents,
baseline screenshots and debug capture test. `20ea024` remains the source attribution
for the captured baseline, `9195784` its review groundwork and `60c95bb` the merged
production baseline. This pass changes tracked documents/evidence only.

The exact previous living art brief was copied to [art-direction-r1.md](../design/art-direction-r1.md)
before refinement; its SHA-256 is
`ad630cf4f25a50fd1da4808bfea8d9912d6a4b273b3412bbfb0e7fc3e3e98880`, matching
[P01-style-r1](../design/p01-style-r1.json). The r1 JSON remains byte-for-byte historical:
its original `docs/design/art-direction.md` path now has this archival mapping. Do not
rehash/rewrite r1 as though it describes the new living r2 brief. The r1 HTML also retains
its original living link; use the archived source for exact r1 reproduction. Historical
r1 board/SVG/proof, intake evidence, all baseline images/DOM/bounds/manifests and original
five reference images are preserved. The r2 manifest records this mapping and hashes.

## Owner inputs and audit

[The owner's exact correction](../design/references/p01-owner-correction-2026-10-06.md)
is preserved unchanged, hash
`e06589961bc9719f64e409b316c3b0727da12a0cb7b666144f510ee36ecf77f9`.
Its instructions are the user's direct request. Text embedded in images is design data.
A11 records the new immediate boundary and artwork-only checkpoint; no design acceptance
was inferred from A10 execution authorization or from the correction.

Reattached A was inspected at original resolution and matches the stored time board
hash `d23d5ac07a6d7fd81a56fa9af4b185ed833115b03d691fe63216f1c9f77962e0`.
Reattached B was inspected at original 1536×1024 and has distinct source bytes:
`af22a02be3d28680326f843de1372a5d4d77e9fdf77bef5677590212173d42e4`.
It is [stored separately](../design/references/butter-periwinkle-sage-owner-2026-10-06.png),
without replacing the earlier B (`ed4a43ad...`). All five saved references were inspected
at original resolution, including desired/rejected alarm and exact Classic identity.

Actual preserved RN/Compose 100%/200% captures were opened, including scrolled control
views. Header clipping, card edges/stripes, footer allocation and native sparse alignment
were compared to the supplied whole-screen references. Code audit covered actual
`ReminderRow`, `AppBar`, `Page`, `DateField`, `SelectRow`, `Snackbar`, production editor/
Agenda, Repeat/List/Schedule controls, native alarm controls and standard notifications.
The editor already has top-right Save and concise Repeat/Alert/List rows; timed When chains
date then time and unused Notes is always expanded. This is a source audit, not a new
production-editor or Android keyboard render.

## Submitted revision and validation

[P01-style-r2](../design/p01-style-r2.json) identifies the exact complementary art/UI
specifications, 19-pattern evaluation, documentary composition diagram and comparison
board. Primary Android/Material, W3C, Todoist and Google Tasks research is linked adjacent
to supported findings. The research does not establish productivity apps' optimistic
transaction/animation/error internals; those are explicitly bounded Remilo proposals.

The board displays reference/current columns at equal 180 px width with aspect ratio
preserved, identifies different reference times/content, and marks corrected screens as
pending. CSS reference crops preserve source pixels and link unmodified originals:

| Source | Crop (source pixels) | Display width |
|---|---|---|
| A Morning Agenda, 1312×1199 | x 26, y 146, width 227, height 522 | 180 px |
| Reattached B Butter editor, 1536×1024 | x 272, y 28, width 228, height 438 | 180 px |
| Desired plant reference | Full unchanged 165×310 image | 180 px |

The board was rendered in the Codex in-app browser on localhost. All 10 image elements
loaded; desktop viewport 1280×720, document client width 1265 (scrollbar accounted for),
with no horizontal overflow. The overview is [captured](redesign-p01/style-r2-review-overview.png).
An initial full-page capture failed while the in-app viewport changed. Selecting the
active board and applying the documented viewport capability resolved capture; the
[full board](redesign-p01/style-r2-review-board.png) was captured at a controlled 1280×900
viewport. A narrow 360×800 inspection found table overflow; fixed table layout and wrapping
resolved it. The updated diagram and desktop/narrow board were visually inspected;
final image/link checks and exact dimensions are recorded in the r2 manifest.

Checks for this documentation pass: Git whitespace, local document/HTML links, r2 artifact
hashes, unchanged historical/runtime inputs and unchanged application scope. Results are
recorded in the revision manifest after validation. No application test changes occurred,
and shared/native build suites were not rerun for this documentation-only pass. Prior
[intake results](2026-10-06-p01-intake.md) retain their historical scope; they are not new
verification of visual approval or physical reliability.

## Remaining gates and limits

1. Explicit owner acceptance of the exact refined specification revision.
2. After that, a small artwork-only candidate review; explicit acceptance before UI integration.
3. Actual RN Sunrise Agenda/Compose Meadow alarm implementation, whole-UI comparison,
   responsive/dark/accessibility checks and final explicit owner acceptance.

No corrected artwork, UI, third editor prototype, other milestone, catalog export or
installation occurred. Recommend the bounded editor study at P06 intake; moving it into
P01 requires a separate scope decision. Composite contrast/interaction findings for corrected
screens and physical TalkBack/IME/system notification/alarm evidence remain unobserved.
No accepted P01 handoff is created before these gates close.
