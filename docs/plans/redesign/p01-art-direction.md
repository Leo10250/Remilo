# P01 Art Direction

## 1. Objective and user-visible outcome

Establish an owner-approved environmental illustration and composition contract
through two representative screens: actual React Native Agenda and actual native
Compose Water plants alarm. The corrected experience should visibly belong to
the supplied soft illustrated references, with readable content and usable actions.
This is a non-shipping design milestone, not permission to redesign the entire app.

## 2. Current relevant repository state

Read [the reassessment](../../evidence/2026-10-06-redesign-reassessment.md) and inspect
the checkout. Review groundwork tracked by commit `9195784` includes
`src/ui/design-review.tsx`, `src/ui/review-appearance.ts`,
`verification/ui/design-review-fixtures.ts`, the
opt-in Metro resolver, source-icon/candidate art in `assets/design-review`, and
debug native review fixtures/tests around actual `AlarmControlsScreen`.

These are useful, unapproved groundwork. The isolated glossy plant and faint
footer retain old sparse geometry and do not satisfy the environmental reference.
Production settings remain brightness-only; no shipping classifier/appearance
policies exist. The last recorded full shared run failed; those historical results
do not verify current HEAD, and native host results are not
owner approval. No earlier AR-00 gate may be assumed complete.

## 3. Scope

Execute in five bounded stages, stopping at the stated owner gates:

1. **Intake and attribution.** Read contracts, approvals, references and actual
   Git state and any new dirty diff. Inventory preserved work; identify safe
   review-only edit boundaries.
   Fix the controlled fixture clock/zone, content, viewport, font scale and brightness.
   Re-render the current two screens before evaluating them; retain the owner's
   rejected screenshot separately because it may represent an earlier revision.
2. **Visual audit and brief.** Compare reference and current at equal display size.
   Record composition, scene coverage, palette hierarchy, illustration vocabulary,
   negative space, text hierarchy, action geometry and large-text behavior. Create
   `docs/design/art-direction.md` as a proposed contract with concrete diagrams or
   reference crops, not adjectives alone. Obtain brief approval before corrected art.
3. **Two corrected prototypes only.** Implement a representative Sunrise Agenda
   at 08:00 and a full Meadow Water plants alarm, using existing actual components
   and review-only fixtures. If assets are needed in this later authorized session,
   generate/prepare only those two compositions under the approved brief; preserve
   originals/provenance. Do not expand eight palettes or all thirteen review scenes.
4. **Render and evaluate.** Produce attributed actual screenshots and side-by-side
   original/current/corrected comparisons. Inspect light/dark, 100%/200% text,
   long English/Chinese titles, larger/expanded layouts and reachable actions.
   Evaluate actual composite contrast, not palette values alone. Iterate narrowly.
5. **Owner acceptance and handoff.** Present both screen comparisons plus the style
   contract and evidence. Await explicit acceptance of the identified revision.
   Record conditions and resolve them; hand off only accepted material to P02.

Use one coherent art-direction contract across RN and Compose. If work is later
divided between chats, share this contract and composition interface first;
do not assign independent agents separate aesthetic briefs.

## 4. Explicit non-goals

No production navigation, storage migration, preference behavior, classifier,
automation, alias switching, audio/scheduling changes or installation. No full
theme catalog, brand reinterpretation, all-app comparison expansion or permanent
replacement of existing assets. No claim of native keyboard/TalkBack/phone proof.
Do not execute P02 simply because the prototypes pass tests.

## 5. Prerequisites and dependencies

Hard prerequisites: None.
Integration dependencies: None.

The owner has reviewed/preserved the planning structure (A06), but P01 execution
still requires explicit authorization in a new session. Read
[approval records](../../design/approvals.md), [product](../../product.md),
[appearance](../../appearance-redesign.md), [architecture](../../architecture.md)
and [verification](../../verification.md). Verify the immutable reference inventory
and baseline review isolation before editing. Missing prior visual approval is
the problem P01 resolves, not a reason to invent one.

## 6. Relevant product requirements

- Hybrid browsing atmosphere with restrained row accents and richer isolated scenes.
- Agenda uses current local time atmosphere; a single Water plants alarm is full
  Meadow. The initial alarm canvas remains unchanged for that session as members change.
- Native Stop silences delivery only; Snooze is 10 minutes; unfinished state remains.
  Current ringing delivery and consequential event timing must remain comprehensible.
- Readable negative space, >=48 dp actions, scalable system typography and explicit
  non-color state cues. Artwork yields to content, not content to an image.
- Preserve the exact Classic identity; no generated redesign of its symbol.
- Engine, protected storage, deadlines and native startup remain untouched.

## 7. Approved visual references

Use [the inventory](../../design/references/README.md), especially
[desired Water plants](../../design/references/desired-water-plants-reference.png),
[time atmosphere/alarms](../../design/references/time-of-day-and-alarms.png) and
[Butter/Periwinkle/Sage](../../design/references/butter-periwinkle-sage.png).
They are approved inspiration, not pixel-perfect layouts or final tokens.
The [rejected current alarm](../../design/references/rejected-current-water-plants.png)
is the negative comparison. The supplied Classic board is exact identity input.

## 8. Required design decisions

**Approved:** environmental soft cartoon/editorial direction, hybrid hierarchy,
Sunrise Agenda/current-time policy, full Meadow Water plants and frozen session
canvas. No existing candidate composition or palette is approved.

**Proposed, requiring owner approval:** art-style contract and each corrected
composition. The brief must specify silhouette language, layered depth without
glossy object rendering, leaf/hill/cloud vocabulary, palette relationships, scene
coverage and text-safe regions. Describe cropping, anchoring and scalable scene
zones with visual examples; do not hard-code all later screens' dimensions.
Specify title/time/status/action hierarchy, normal and 200% text reflow, dark
adaptation, overlap prohibitions, and atmosphere versus member-art roles.

**Agent choices:** review-only file organization, static asset format/export sizing,
fixture implementation and capture tooling within existing isolation. Explain
tradeoffs; choose measurable composition constraints over opacity-led suppression.
If the brief needs a product change, stop for explicit approval.

## 9. Expected deliverables

- Reference/current audit with annotated differences and root causes.
- One proposed, then explicitly approved `docs/design/art-direction.md` contract.
- Exactly the two representative corrected review compositions, with source/asset
  provenance and actual RN/Compose captures, not image-generated UI screenshots.
- Side-by-side original/current/corrected sheets at common scale. Mark reference
  mockups as reference and host renders as synthetic; never imply a phone capture.
- A render manifest including commit/dirty-input hashes, renderer versions, fixture
  IDs, clock/zone, dimensions, font scale, brightness and assets. Preserve captured
  baseline so later changes cannot masquerade as the current comparison.
- Redacted design/accessibility evidence, approval records and
  `docs/handoffs/redesign-p01.md` following [the protocol](../../handoffs/README.md).

## 10. Functional acceptance criteria

- Agenda fixtures retain identical titles, event/due/alert relationships and work/
  delivery states between current/corrected; no semantic simplification to improve art.
- Include Water plants, medicine, work and a later reminder; ordinary, overdue and
  changed-delivery cues are understandable without color. Completion is not Stop.
- Alarm shows one Water plants member with current ringing delivery and independent
  Stop/Snooze. Fake callbacks do not access engine/storage/audio. Add/remove a second
  fixture member and verify the initial Meadow canvas does not recolor; do not
  expand this into the complete production multi-alarm milestone.
- Review routing remains opt-in web/debug-only. Normal/Android entries use real
  bridge and production control defaults are unchanged. No database/data mutations.
- Art or token failure produces usable text/actions; content can scroll at 200%.

## 11. Visual acceptance criteria

- The plant scene is an integrated botanical environment with purposeful layered
  coverage, not a centered sprig pasted above a large empty middle. Agenda has
  visible, restrained integrated scenery rather than a barely perceptible footer.
- A common soft editorial vocabulary links both scenes while preserving Sunrise
  versus Meadow personality. No decorative bokeh/orbs, mismatched glossy object art,
  UI-in-image, frame/card around the primary scene, or new logo interpretation.
- Title, event/delivery time, state and actions have clear hierarchy at 360x800.
  No overlap, clipped words or artwork behind essential content that breaks contrast.
- Test at 360x800 and at least one larger phone and one expanded viewport, light/dark,
  100%/200% text and long English/Chinese. Record exact sizes rather than guessed ones.
- Actual composited normal text >=4.5:1, large text >=3:1, essential controls/selected/
  focus indicators >=3:1. Check grayscale and reduced motion. At large text, reduce
  or reflow art without losing content or controls. Do not fade the whole experience
  as the primary solution. Native TalkBack/keyboard behavior stays an explicit P12 gate.
- Owner explicitly accepts both renders and the style specification. Agent judgment,
  asset checks, attractive screenshots and test success alone do not pass.

## 12. Verification requirements

Use `npm run preview:ui` and the opt-in actual RN fixture, plus existing debug native
graphics tests/gallery around `AlarmControlsScreen`. Reuse source isolation and
read-only asset checks; inspect test runner options before selecting focused tests.
Run `npm run verify` and relevant `npm run verify:android` after review code changes;
diagnose the existing shared ENOENT failure without weakening tests. Run release
producing commands serially; no install. Record actual exit results and limitations.

Capture the render matrix and representative interactions; check component bounds,
nonblank artwork, clipping and reachable actions, then measure composited contrast.
Keep synthetic evidence distinct from Android system notification rendering or
device behavior. Restore/stop preview processes when finished. Full host success
is a handoff requirement; any failed check must be reported and resolved or receive
an explicit bounded deferral, never represented as passed.

## 13. Regression risks

Review slots leaking into production; fixture hooks creating a second state owner;
large text reducing scenes to meaningless fragments; asset/style mismatch between
RN and Compose; inaccurate render attribution; art covering action targets;
frozen canvas derived from mutable member order; expanding scope before approval.

## 14. User approval checkpoints

1. Explicit authorization to execute this plan, separate from documentation review.
2. Reference audit/style brief approval before corrected asset/composition work.
3. Explicit approval of both attributed corrected screens and responsive/dark
   behavior before P02/theme expansion. Record artifact IDs and conditions in
   [the ledger](../../design/approvals.md). If rejected, revise only P01.

## 15. Completion and handoff requirements

Preserve baseline work, commit only this bounded milestone, update live status only
in backlog, and record actual checks/limitations in evidence. Handoff must identify
approved style revision, accepted screen/asset hashes, render matrix, composition
constraints and what P02 may generalize. Missing owner acceptance prevents accepted
handoff, even with green tests. Pending physical evidence remains explicitly pending.
Stop after P01; do not start P02 or replace production branding.

## 16. Fresh-chat execution prompt

```text
Execute P01 Art Direction only, using docs/plans/redesign/p01-art-direction.md.
There are no milestone dependencies; verify input prerequisites and my explicit
execution authorization before any prototype work.
First read AGENTS.md, docs/product.md, docs/backlog.md, docs/architecture.md,
docs/verification.md, docs/appearance-redesign.md, the redesign index,
docs/design/README.md, docs/design/approvals.md, the preserved reference inventory
and docs/evidence/2026-10-06-redesign-reassessment.md. Inspect actual Git state and
preserve all existing valid dirty work. Confirm my explicit P01 authorization;
do not treat the planning baseline as execution permission. Stop on missing inputs.
Audit reference/current actual RN Agenda and native Compose Water plants renders.
Propose the style contract and await my brief approval before corrected artwork.
Then implement only the two isolated representative prototypes, capture attributed
original/current/corrected comparisons and verify composite contrast, 200% text,
responsive behavior, fixture interactions and web/debug isolation. Agenda follows
current-time atmosphere; the Water plants alarm is full Meadow with a frozen initial
canvas. Do not change production behavior, generate the full catalog, deploy or
start P02. Await my explicit approval of both actual renders and style contract.
Record real test results, approval artifacts, evidence, backlog and P01 handoff.
```
