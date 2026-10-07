# P01 Art Direction handoff

This records P01's accepted bounded delivery. Live task state belongs only in
[backlog.md](../backlog.md). Approval is of the two non-shipping representatives,
not a production redesign or physical alarm acceptance.

## Revision and acceptance

- Plan: [P01 Art Direction](../plans/redesign/p01-art-direction.md).
- Base: `10cb67c8e5cd251bb071a5b020b659e870a0eed7` on `theme-update`, matching the
  locally recorded tracking revision at intake; no fetch or branch switch occurred.
- Implementation commit: `12a5e6ac6babc6358afb8d33b9caf5da0b308a24`
  (`feat: add P01 art-direction review prototypes`). The following documentation
  commit carries A15, this handoff and the linked contract/backlog updates. At
  handoff preparation these documents are the only remaining dirty scope; no
  unrelated work is included. Ignored tooling/build artifacts remain local.
- Accepted render revision: `P01-render-r1`, bundle SHA-256
  `6616bc8f98aee19982f132d9635ccc6e73d719fcf425040017d52fc4e0ba0053`.
  [Submitted manifest](../design/p01-render-r1.json) SHA-256
  `db88ea35c4633b57120d35821c45ebb27e84baa692e22337a2c7f4885ce02200`.
- Owner acceptance: [A15](../design/p01-render-r1-acceptance.json), exact words
  “Approve”, directly answering the final rendered UI approval question. No new
  owner conditions were stated. Standing scope/device boundaries remain.
- Preceding accepted inputs: A12 / P01-style-r2 direction, bundle SHA-256
  `32f913e8c46a03210dc0372527e86c102f446f4d50cf0cfe822f74c67d647728`;
  A14 / selected S1 and M1 source artwork. A10 authorized P01 execution; A11
  required the refinement and added artwork-only approval. No milestone dependency
  handoffs were required.

The r2/r1 submitted artifacts, historical approval records, baseline and candidate
sources remain unchanged. Their pending/proposal labels describe submission time;
separate acceptance records carry later decisions. Material changes require renewed
acceptance. Approval does not extend to M2/S2, exact reusable production tokens,
detailed production UX, final production layouts, installation or another milestone.

## Delivered scope and interfaces

Exactly two actual component prototypes: S1 Sunrise Agenda through React Native
shared components, and M1 Meadow Water plants alarm through AlarmControlsScreen
and actual Material Button/OutlinedButton controls. The full reference/current/
corrected comparison, light/dark treatments, responsive/large-text stress renders,
accessibility measurements and frozen-session demonstration are retained in the
[review board](../design/p01-render-review-r1.html) and
[evidence](../evidence/2026-10-06-p01-prototypes.md).

Changed review implementation:

- `src/ui/design-review.tsx`, new `p01-review.ts`, review fixture descriptors and
  optional ReminderRow editorial radius/line-height. Actual shared actions and
  timing/work/delivery presentation remain. Existing A/B/C review approaches remain.
- `AlarmControlsScreen.kt`: one optional internal single-member presentation slot
  receives the actual information/actions/feedback blocks. Its null default keeps
  production layout and callbacks. Debug activity and new P01AlarmReview own the
  memory-only environmental composition and session-ID initialization.
- Bounded P01 PNG/contract exports, source/hash/parity checker, render contrast/
  semantics checker, three shared domain cases, five focused native graphics/
  interaction cases and review-isolation coverage.

No engine, serialized mutation path, generation validation, storage, backup, bridge
API, preference, classification, scheduling, audio, notification, launcher or
production navigation behavior changes. Credential/operational/backup versions
remain 4/3/3. Stop still leaves work unfinished. No engine/database/service/audio
controller is acquired by review callbacks. Debug activity is non-exported and
absent from the assembled release manifest. Twelve default native captures are
byte-identical to the preserved intake baseline.

## Accepted assets and composition constraints

| Artifact | SHA-256 |
|---|---|
| S1 source, `docs/design/artwork/p01-artwork-r1/sunrise-s1-horizon.png` | `bc91beb4bc6f1bf78285d1fe08ad495fa8cfe60f0b4a848755a5b757adc26e3b` |
| M1 source, `docs/design/artwork/p01-artwork-r1/meadow-m1-canopy.png` | `300467ae10d40efcf7e7a61c5e53660b424d4e1c7814facea7d02f073d9021eb` |
| S1 export, `assets/design-review/p01/sunrise-s1.png` (1440×960) | `7851e2c7ff0e617644f09e9bfe601e32ee19ad6f6094f2cb62229176747d7300` |
| M1 export, `assets/design-review/p01/meadow-m1.png` (1024×1536) | `da25a9bfd284bc267805a323e8eed9c51a4673efea4646a24900a01f455f3ee5` |

Debug native `p01_sunrise_s1.png` / `p01_meadow_m1.png` have identical export bytes.
Originals, prompts, direct references and unselected candidates remain preserved.
No broad icon exporter or full theme catalog generation was performed. Exact
Classic source/crop identity remains intact; production branding is P03.

Consume [art-direction.md](../design/art-direction.md),
[ui-composition.md](../design/ui-composition.md),
[pattern evaluation](../design/p01-pattern-evaluation.md),
[derived composition notes](../design/p01-render-r1-notes.md) and the review-only
`assets/design-review/p01/composition.json`. Their exact hashes are in the accepted
manifest. The reference images remain primary visual quality targets.

Sunrise uses an opaque reading column of at most 560 dp over a cream environment;
aspect-preserving width-fit artwork keeps S1's sun 34 dp above navigation. A 68 dp
lower action clearance permits the last reminder to scroll above the real 56 dp
Add action. Large text grows without essential truncation. Dark adaptation retains
the same scene geometry. This is review navigation/fixture layout, not P05 behavior.

Meadow uses a continuous canvas, integrated upper/side canopy, 480 dp maximum
information/action column and a local 48 dp reading transition. Title, current
ringing delivery, 08:00 target, ringing status, Stop, Snooze · 10 min and unfinished
explanation form one scrolling sequence. Event/due stress metadata is debug-only.
Memory-only canvas initialization follows session ID: membership/reordering/removal
does not replace Meadow; a new session initializes anew. Durable policy remains P08.

## Evidence and checks actually performed

Frozen clock: 6 October 2026, 08:00, America/Los_Angeles; en-US formatting and
authored synthetic Chinese content. Both brightnesses, 100%/200% text and standard/
long English/long Chinese at 360×800, 412×915 and 800×1024. RN has 97 current/
corrected captures, including 18 large-text end views; Compose has 100 paired
top/control captures and five session-sequence captures. Additional states cover
overdue/changed delivery, consequential timing, errors, generic content, missing
art, invalid tokens and reduced motion. Indexes bind bounds, fonts, density,
canvas/viewport, fixture and scroll state; the manifest binds all 465 render files.

Completed during prototype execution, exit 0:

- `npm run verify`, using pinned Node 22.23.3 and process-local TEMP/TMP in ignored
  `.tooling/p01-temp`: TypeScript, lint, 127 tests in 14 files and 43 tooling cases.
- Existing read-only `verify-design-review-assets.mjs` and bounded
  `p01-review-assets.mjs --check`: exact Classic pixels, existing asset checks,
  accepted P01 sources, dimensions and RN/native export/contract parity.
- Focused Compose native graphics/semantics tests: five passed. Serial
  `npm run verify:android`: 105 native tests in 13 suites, lint and release assembly
  passed, with existing dependency/deprecation warnings and no lint errors.
- `verify-p01-renders.mjs`: 3,190 visible text/indicator measurements passed, 38
  current/corrected Agenda semantic pairs matched, and reachable/minimum-size
  targets plus actual native control boundary contrast passed.
- Git whitespace, accepted input hashes, default-native baseline parity, protected
  source scope and 512 local review links. Browser board filtering returned 24
  expected native/dark/200% views without mismatches.

Measured minima: normal text 5.566:1 (required 4.5), large text 3.567:1 (required 3),
essential indicators 4.949:1 (required 3), native control boundaries 3.977:1
(required 3). [Redacted verification](../evidence/redesign-p01/render-r1/verification.json),
[contrast](../evidence/redesign-p01/render-r1/contrast.json),
[semantics/controls](../evidence/redesign-p01/render-r1/semantics-and-controls.json).

Approval finalization rechecked 518 recorded source/asset/evidence hashes and the
complete bundle digest without regenerating accepted artifacts. No application
code changed during acceptance. Acceptance metadata, 177 linked handoff/contract
documents and the committed implementation source hashes were also checked.
Historical submission evidence is preserved;
fresh source attribution remains available from the manifest and the implementation
commit recorded above.

The signed ARM64 `com.remilo.app` 0.4.0 (4) APK was assembled for verification only,
SHA-256 `641ad14cb962db09af01239d02e7a675dc0a1590cbcdb1d638ca51eeaafa221d`.
It remains an ignored local build artifact; no installation, launch or distribution
occurred. No private host logs, keys, APKs or local tooling enter the P01 commit.

## Limitations and next bounded work

RN evidence is actual shared components through the opt-in static web export;
Compose evidence is actual native graphics through Robolectric 4.17 / API 35 / mdpi
with synthetic zero system insets. The host screenshot backend paints at inverse
display density, so labelled comparison derivatives normalize the measured frame;
unmodified captures and crop records remain. These are synthetic host results.
The submission evidence records the earlier temp/SSR, cache permission, fractional
text-bound and screenshot-density failures and their resolutions.

TalkBack, Android keyboard/Back, real insets, notification UI, physical alarm/audio/
recovery reliability, performance and manufacturer coverage remain pending in the
existing consolidated [device acceptance](../device-acceptance.md)/P12 process.
This acceptance does not waive those gates or verify/distribute the beta.

P02 may consume the accepted illustration/UI vocabulary, representative assets,
crop/readability constraints and measured accessibility results after separate
execution authorization. Refine [P02](../plans/redesign/p02-visual-foundations.md)
against this actual repository first. Its shared/native primitives, representative
expansion sample, eight-environment catalog, exact production tokens and export
approval remain P02 work. Do not extrapolate the old candidate icon/palette catalog
as accepted or implement navigation, appearance persistence, classification,
durable session freezing or launcher behavior under this handoff.
