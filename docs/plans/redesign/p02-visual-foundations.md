# P02 Visual Foundations

**7 October 2026 intake override:** read
[the approved R3/R4 template and corrections](../../design/approved-ui-r3-r4.md)
before continuing foundations. A20 adds the accepted R5 Sky/Evening variants;
read their per-image notes in the combined twelve-screen Details/Editor gallery.
The accepted R3 homepage/R4/R5 secondary-page template
and corrections supersede conflicting old visual assumptions below. One global
atmosphere with independent brightness applies across screens; task-specific
environments/manual reminder appearance are deferred. The earlier eight-palette,
Sky/Rose and Classic rollout sequence remains recorded history/planning requiring
refinement against this direction, not acceptance of additional production work.
Four preview atmospheres do not define replacement switching/migration policies.

## 1. Objective and user-visible outcome

Turn P01's accepted direction into reusable, accessible RN/native primitives and
eight intentional light/dark environments, without redesigning workflows or storage.

The owner explicitly authorized this refined execution through A16 on 6 October
2026, after the accepted P01 handoff. Approval of the plan is not acceptance of
unbuilt artwork, tokens or renders. The sequence below is binding.

## 2. Current relevant repository state

Production uses `src/ui/tokens.ts`, `colors.ts`, `theme.tsx`, `components.tsx` and
encapsulated Material icons. Native rendering is extracted into `AlarmControlsScreen`.
`review-appearance.ts` and review assets are unapproved candidates. Inspect
[the baseline](../../evidence/2026-10-06-redesign-reassessment.md) and P01 handoff;
do not assume the complete catalog or final tokens already exist.

Intake is clean `1b91f34` on `theme-update`. A12/A14/A15 accept the bounded P01
direction, S1/M1 sources and actual representatives. Recheck their recorded hashes.
Production Agenda uses continuous sectioned rows with trailing completion, unlike
the P01 separated review tiles. Preserve that structure under P02. Current native
alarm appearance is duplicated in AlarmActivity and the debug baseline wrapper.
Both invoke the actual AlarmControlsScreen. Credential/operational/backup versions
are 4/3/3 and remain so.

## 3. Scope

Define shared typography, spacing, color roles, focus/selection/loading/error states,
item/sheet/control geometry and artwork placement. Develop reviewed static tokens
using Material color tooling; export one catalog to TS and native resources.
Extend P01's approved illustration vocabulary first to a representative expansion
sample, then to Classic, Sunrise, Sky, Meadow, Peach, Rose, Lavender and Mist.
Adapt shared primitives conservatively, preserving public behavior and default APIs.

After complete-catalog approval, activate shared Classic colors/type/control
styling in existing RN and native screens. Production scenery stays inactive.
Expose 16 dp tile styling additively for later adoption; P05 owns separated
production tiles and leading completion. P04 owns saved appearance and P08 owns
environmental native layouts/session capture. No new palette preference is needed
for the usable Classic default. Existing System/Light/Dark behavior remains.

## 4. Explicit non-goals

No schema/backup changes, preference automation, classifier, navigation/editor
rewrite, production icon export, runtime palette generation or alias/background work.
Do not reinterpret P01 or independently commission a different native art style.

## 5. Prerequisites and dependencies

Hard prerequisites: P01.
Integration dependencies: None.

Require accepted P01 handoff and explicit owner approvals for both representative
renders and `docs/design/art-direction.md`. Refine this plan against that contract
before implementation; exact palette values/compositions are intentionally open.
Read [shared handoff rules](../../handoffs/README.md) and [approval ledger](../../design/approvals.md).

## 6. Relevant product requirements

System typography: 16 sp body, 14 sp support; 4 dp rhythm; 16 dp reminder tile corners,
larger sheet corners, restrained elevation and >=48 dp targets. Brightness is
independent of palette. Explicit labels distinguish status from decorative identity.
Artwork is integrated but outside essential text; content and large text win.
Use existing icon encapsulation, not a competing icon framework.

Passive field/disclosure icons and chevrons use neutral `onSurfaceVariant`.
Toolbar glyphs share one contrast-protected neutral content role across matching
screens, as specified in the canonical correction table. The atmosphere primary
role is for intentional actions, focus and explicitly
selected controls, not all icons in an accented screen. Category badges retain
separate semantic identity. Warning/error/success colors require meaningful text
and state; an Independent relationship badge stays neutral. A labeled Scheduled
success state may use the success role, while its ordinary Alarm glyph remains a
structural neutral icon. Do not infer exact token values from generated pixels.

## 7. Approved visual references

Inherit P01's approved style contract and captures, checked against
[supplied references](../../design/references/README.md). Reference-board swatches
and current review tokens are proposals, not approved final values.

## 8. Required design decisions

Consume the owner-accepted P01 [UI language](../../design/ui-composition.md) alongside
[illustration language](../../design/art-direction.md): type/spacing, rounded surfaces,
headers, controls, state and responsive hierarchy. The linked r2 proposal is not accepted
by inference. Finalize tokens from actual renders; do not generalize r1's existing geometry.

**Approved:** eight names, dual brightness, one shared static catalog, 16 dp tiles,
Sky/Rose sample, artwork-only checkpoints and shared Classic activation after
catalog approval. Starting values: display 28 sp, app bar/time 22 sp, heading
18 sp, body/title 16 sp, support 14 sp, minor metadata 12 sp; approximately 1.4x
line height; spacing 4/8/12/16/24/32 dp; 16 dp phone gutter; tile/group 16 dp,
field/action 12 dp, sheet 24 dp; >=48x48 dp targets and existing 64 dp native
single-alarm controls. Natural wrapping/growth wins over fixed heights.

Use the same component anatomy, radii, padding and control geometry in Light and
Dark; brightness changes token roles rather than inventing another component.
Apply the per-image R4 corrections when rendering actual shared/native primitives.

**Proposed:** exact roles/values, dark scene treatment, per-theme compositions,
responsive asset placement. Obtain owner approval before
full-catalog production. Record a catalog version and reviewed export contract.

**Agent choices:** source format, deterministic exporter, asset density/size budget
and primitive internals after reviewing existing patterns. Do not add runtime HCT.

## 9. Expected deliverables

Reviewed catalog and foundation specification under `docs/design`; reusable
RN/native exports and static assets with provenance; primitive state gallery;
light/dark/large-text screenshots and contrast/parity report; P02 evidence,
approval records and `docs/handoffs/redesign-p02.md`.

## 10. Functional acceptance criteria

- Existing control callbacks, loading/errors, disabled/selected states and focus
  semantics survive primitive changes; no behavior change through styling.
- Unknown catalog IDs and missing assets yield usable Classic/system fallback
  without modifying stored choices. Native and RN roles/assets resolve consistently.
- Production defaults are usable without new saved appearance configuration.
- Stable control/item dimensions do not shift with icons, progress or text states;
  labels scale and reflow instead of shrinking with viewport width.

## 11. Visual acceptance criteria

All sixteen palette/brightness combinations follow P01 and remain distinguishable
without a one-hue-dominated app. Status colors remain labeled. Measure composite
normal/large text at 4.5:1/3:1 and essential control/selection/focus at 3:1.
Review 360x800, larger/expanded, 200% text, English/Chinese, grayscale and reduced
motion; no overlap, clipped actions, nested section cards or image-only controls.

## 12. Verification requirements

Run shared verification and relevant native unit/lint/assembly checks serially.
Add focused role/export/unknown-ID tests and primitive state/render fixtures.
Use actual RN/Compose captures for parity and contrast. Device TalkBack and keyboard
claims remain P12 observations; do not infer them from host snapshots.

## 13. Regression risks

Global primitives have broad blast radius; styling can hide disabled/focus states,
desaturate meaningful status, change hit targets or diverge across renderers.
Unreviewed expansion can reproduce the P01 mismatch. Avoid concurrent catalog edits.

## 14. User approval checkpoints

Execution is authorized by A16. First accept selected Sky/Rose source hashes before
integration; accept the actual rendered expansion sample before the remaining
themes; accept the remaining four source hashes before full-catalog integration;
then accept the complete catalog/primitives and prospective Classic styling with
actual light/dark/large-text evidence before production activation.
Approval must identify catalog/asset revision; no test-only design approval.

## 15. Completion and handoff requirements

Deliver a stable catalog/export and composition interface for P03/P04/P05/P08.
Record accepted assets, fallback rules, checks, unresolved physical observations
and focused commit in the standard handoff. Update status only in backlog. Do not
start branding, persistence or navigation work without their separate authorization.

## 16. Fresh-chat execution prompt

```text
Confirm A16 execution authorization and accepted hard prerequisite artifacts/approvals.
Work on P02 Visual Foundations only. Read AGENTS.md, the four core docs,
docs/appearance-redesign.md, docs/plans/redesign/README.md and
docs/plans/redesign/p02-visual-foundations.md,
docs/design/approvals.md and the P01 handoff. Inspect actual source and verify P01
owner acceptance of both renders and the art-direction contract; stop if missing.
Follow this refined plan and obtain remaining artwork/sample/catalog approvals.
Generate two Sky/two Rose candidates first; obtain source approval before integration.
Implement shared RN/native primitives and one static reviewed eight-palette light/
dark catalog, not workflows, storage, icons or automation. Preserve existing work
and behavior. Obtain my approval of the actual sample before generating the remaining
Classic/Peach/Lavender/Mist sources, then source approval before full integration.
Obtain complete catalog approval before activating shared Classic styling. Verify
rendered accessibility, large text, parity and relevant shared/native checks.
Record evidence, exact owner approvals, backlog and P02 handoff; stop before P03/P04.
```

## 17. Authorized implementation sequence

### A. Intake and unchanged-screen baseline

Record A16, base/source hashes and the unchanged accepted P01 bundle. Capture
actual production-layout Agenda/editor/details/Settings through the opt-in
fixture bridge, and actual native single/multiple controls through the debug
host renderer, at both brightnesses. Preserve originals and hash the renderer,
fixture inputs, clock/zone, viewport, density, fonts, insets and scroll state.
These are synthetic host captures, not Android/device evidence. No foundation
defaults change while establishing the baseline. One integrator owns shared work.

### B. Sky/Rose source-artwork gate

Use built-in imagegen for two Sky and two Rose source candidates, scenery only.
Sky has broad blue atmosphere, layered clouds/hills and open reading regions;
Rose has overlapping rose botanical clusters entering from edges and a quiet
middle/lower reading region. Inherit accepted soft editorial layering, rounded
asymmetric silhouettes and broad environmental coverage. No UI/text/logo,
glossy isolated objects or flattened screenshots. Request real alpha.
Preserve original outputs/prompts/reference roles/dimensions/alpha/hashes.
Present unmodified sources beside original references and accepted P01 sources,
with separately labeled crop/quiet-region diagrams. Obtain selected source
acceptance; rejected sources are revised inside this bounded set.

### C. Actual rendered expansion sample

Build the initial catalog/export path and reusable primitive gallery using
approved Sky/Rose plus accepted Sunrise/Meadow comparison anchors. Use actual
RN shared controls and actual Compose Material controls: both brightnesses,
100%/200% text, standard/long English/authored Chinese, and default/pressed/
focused/selected/disabled/loading/error states. Each new theme gets browsing and
richer individual compositions, with art placement independent from content.
Obtain acceptance of identified source treatments, roles, geometry and renders
before generating the remaining environments.

### D. Complete catalog with a second source-artwork gate

Reuse S1/M1. Generate one initial source each for Classic (blue/violet layered
scenery separate from the exact icon), Peach (warm low horizon), Lavender (soft
twilight layers/restrained celestial accents), and Mist (slate mist/hill layers).
Revise only failures; accept source hashes before full-catalog integration.
Light/dark pairs preserve geometry/anchors with intentional scene colors, never
a darkened UI screenshot. Capture all sixteen combinations and primitives.

### E. Full approval then shared Classic activation

Submit the catalog, actual primitives, prospective production-layout Classic
comparisons and evidence. Acceptance binds exact revision, source/export hashes
and renders. Then switch RN production ThemeProvider and native AlarmActivity
to generated Classic foundations, retaining brightness and all layouts/actions.
Remove duplicated native colors/type through the reusable theme adapter. Use
optional tile presentation without enabling review layouts. New scenes remain
inactive. Material activation differences require affected render reapproval.
Run final checks, record evidence/accepted handoff and stop before P03/P04.

## 18. Concrete catalog and export contract

Canonical source: `docs/design/p02/catalog.json`, schemaVersion 1 and identified
catalog revision (initially P02-catalog-r1). Stable IDs: classic, sunrise, sky,
meadow, peach, rose, lavender, mist. Include shared type/space/shape/target values,
complete light/dark roles, existing RN aliases, explicit outline/focus/pressed/
disabled/inverse-feedback/destructive foreground roles, every used Compose role,
asset identity/source dimensions/hashes and normalized crop/anchor/quiet regions
for browsing/individual placement. Future screens own their final layouts.

Pin @material/material-color-utilities 0.4.0 as authoring tooling only. Record
seed/generation parameters and reviewed overrides; no runtime HCT imports.
A dedicated P02 exporter supports --export, read-only --check and --help. Produce
typed TS values/static asset references, Kotlin theme/catalog values/native
drawables, and an export manifest. Reject missing roles, duplicate IDs, malformed
colors, invalid placement and absent inputs. Equal inputs produce identical bytes.
Never run the broad icon/review exporter. The existing bundled Sharp is 0.35.4;
record tool version and transformation parameters for reproducibility.

Use PNG and existing RN/Compose Image, matching asset bytes and preserving alpha/
aspect ratio. No enlargement. New exports: <=1440 px width, <=2 megapixels,
<=2 MiB per image and <=24 MiB unique shipped catalog. Preserve source originals
outside shipping exports. Optimize/downscale failed budgets; any accepted quality
exception requires resubmitted evidence. Representative max columns are 560 dp
browsing and 480 dp individual, without fixed blank art space. Art is excluded
from accessibility and hit testing.

Matching TS/Kotlin types cover palette ID, resolved light/dark brightness,
colors/geometry/scene placement. Pure lookup takes ID and resolved brightness and
returns static rendering values only. P04 owns durable descriptors and policy.
Preserve props/callback signatures and color aliases/review compatibility. Add
optional presentation styling; reuse encapsulated Material icons/fallback.
Explicit pressed/disabled colors replace blanket opacity. Reserve icon/progress
space without fixing content height. Preserve checked/selected/disabled/busy
semantics, focus/error/retry and feedback timing; no new action lifecycle.

Unknown IDs/invalid token sets resolve Classic at the existing brightness.
Failure of requested scenery resolves solid Classic; an intentionally undecorated
surface is not failure. A22 supersedes the normal plain pre-unlock presentation:
generic reminder content still uses bundled global-theme art/tokens through the
reviewed native-safe appearance source in [R6](../../design/r6-alarm-postpone-specification.md).
A23 requires the existing softer elevated Dark surfaces. No content-derived
appearance enters DP. Emergency baseline controls survive catalog failure.
Fallbacks never mutate requested choices or preferences/content/scheduling.

## 19. Concrete render verification and handoff

Matrix: eight palettes x light/dark x 360x800/412x915/800x1024 x 100%/200% text x
standard/long English/long Simplified Chinese. Add targeted missing-art/unknown-ID/
invalid-token, all primitive interaction states, consequential Due/overdue/stopped/
changed delivery, native loading/starting/single/multiple/error/generic, grayscale,
reduced-motion and end/control captures. Background-only sampling retains nodes,
geometry and wrapping. Record all render/capture settings and source hashes;
normalize density only after measurement, preserving unmodified originals.

Actual composite normal/large text reaches 4.5:1/3:1 and essential controls/focus/
selection reaches 3:1. Targets are >=48x48 dp without overlap; essential text is
unclipped and controls reachable; decorative semantics are absent and non-color
cues survive grayscale. Extend existing RN capture/Robolectric workflows.

Focused tests: completeness and TS/Kotlin/image parity; deterministic export/stale
outputs; no-mutation fallback; existing brightness; disabled callbacks/identity;
captured native member/generation and session Stop all; unchanged loading/empty/
failed-action controls and dismissal; wrapping/progress reachability; review
isolation/no engine/storage/service/audio; debug activity/fixtures excluded from
production; all existing timing/recurrence/revision/generation/restore/privacy
assertions retained. After activation run npm run verify, read-only P02 export
check, render verification and npm run verify:android serially. No stack upgrade
or weakened assertions to hide failures.

Complete only after exact artwork/sample/catalog acceptance, matching activated
Classic fixtures and passing required host checks. Deliver spec/catalog, provenance,
assets/exports/exporter, galleries/comparisons, contrast/geometry/semantics/parity/
verification, approvals, focused commits/PRs and the standard P02 handoff. Status
belongs only in backlog. P03 gets roles/IDs, P04 lookup/fallback, P05-P07 primitives,
P08 native theme/placement. Device TalkBack/IME/Back/insets/performance/alarm claims
remain pending in consolidated P12. No installation, distribution or beta verification.
