# P02 Visual Foundations

## 1. Objective and user-visible outcome

Turn P01's accepted direction into reusable, accessible RN/native primitives and
eight intentional light/dark environments, without redesigning workflows or storage.

## 2. Current relevant repository state

Production uses `src/ui/tokens.ts`, `colors.ts`, `theme.tsx`, `components.tsx` and
encapsulated Material icons. Native rendering is extracted into `AlarmControlsScreen`.
`review-appearance.ts` and review assets are unapproved candidates. Inspect
[the baseline](../../evidence/2026-10-06-redesign-reassessment.md) and P01 handoff;
do not assume the complete catalog or final tokens already exist.

## 3. Scope

Define shared typography, spacing, color roles, focus/selection/loading/error states,
item/sheet/control geometry and artwork placement. Develop reviewed static tokens
using Material color tooling; export one catalog to TS and native resources.
Extend P01's approved illustration vocabulary first to a representative expansion
sample, then to Classic, Sunrise, Sky, Meadow, Peach, Rose, Lavender and Mist.
Adapt shared primitives conservatively, preserving public behavior and default APIs.

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

System typography: 16 sp body, 14 sp support; 4 dp rhythm; 8 dp reminder corners,
larger sheet corners, restrained elevation and >=48 dp targets. Brightness is
independent of palette. Explicit labels distinguish status from decorative identity.
Artwork is integrated but outside essential text; content and large text win.
Use existing icon encapsulation, not a competing icon framework.

## 7. Approved visual references

Inherit P01's approved style contract and captures, checked against
[supplied references](../../design/references/README.md). Reference-board swatches
and current review tokens are proposals, not approved final values.

## 8. Required design decisions

**Approved:** eight names, dual brightness, typography/spacing/target requirements
and one shared static catalog across RN/native.

**Proposed:** exact roles/values, dark scene treatment, per-theme compositions,
responsive asset placement and expansion sample. Obtain owner approval before
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

Authorize/refine after P01 acceptance. Approve the expansion sample before remaining
themes, then the full catalog/primitives with actual light/dark/large-text evidence.
Approval must identify catalog/asset revision; no test-only design approval.

## 15. Completion and handoff requirements

Deliver a stable catalog/export and composition interface for P03/P04/P05/P08.
Record accepted assets, fallback rules, checks, unresolved physical observations
and focused commit in the standard handoff. Update status only in backlog. Do not
start branding, persistence or navigation work without their separate authorization.

## 16. Fresh-chat execution prompt

```text
Confirm explicit execution authorization and accepted hard prerequisite artifacts/approvals.
Work on P02 Visual Foundations only. Read AGENTS.md, the four core docs,
docs/appearance-redesign.md, docs/plans/redesign/README.md and
docs/plans/redesign/p02-visual-foundations.md,
docs/design/approvals.md and the P01 handoff. Inspect actual source and verify P01
owner acceptance of both renders and the art-direction contract; stop if missing.
Refine this plan against those outputs and obtain execution/expansion approvals.
Implement shared RN/native primitives and one static reviewed eight-palette light/
dark catalog, not workflows, storage, icons or automation. Preserve existing work
and behavior. Obtain my approval of an expansion sample before the full catalog. Verify
rendered accessibility, large text, parity and relevant shared/native checks.
Record evidence, exact owner approvals, backlog and P02 handoff; stop before P03/P04.
```
