# Redesign approval ledger

This ledger records human decisions, not task status. Live status belongs only in
[backlog.md](../backlog.md). See [approval rules](README.md).

## Recorded owner decisions

| Record | Date | Accepted scope | Not implied |
|---|---|---|---|
| A01 | 6 October 2026 | The supplied large Classic icon is Remilo's actual identity: blue/violet ring, white check medallion, orange sun and dimensional finish. Production adaptation is limited to isolation, layers, padding and sizing. | Approval of coarse masks, color variants, production exports or a redrawn logo. |
| A02 | 6 October 2026 | The owner adopted the supplied redesign product direction: hybrid atmosphere/contextual art, direct Agenda/Lists/Repeats, independent brightness/color, automatic appearance preferences and English/emoji/Simplified Chinese classification. Broad soft environmental illustration should match supplied references. | Blanket approval of every technical choice in the evolving specification, future edits, exact schema/API design, generated scenery, tokens or rendered layouts. |
| A03 | 6 October 2026 | A single Water plants alarm uses a cohesive full Meadow environment; Agenda uses the current time-of-day atmosphere. Freeze the alarm's initially presented canvas when members join or leave. | Approval of a particular Meadow illustration, or deriving the canvas from the current first member on every refresh. |
| A04 | 6 October 2026 | P01-P12 is acceptable as a planning baseline, with separate executable documents and approval gates. | Authorization to implement any milestone or final approval of these newly written documents. |
| A05 | 6 October 2026 | This session creates documentation only. Preserve existing work; do not implement features, generate UI assets or execute P01. The owner will review and explicitly authorize the next session. | Automatic continuation into P01 after documentation verification. |
| A06 | 6 October 2026 | The owner reviewed P01-P12, found the overall structure good and requested preserving it while making focused documentation refinements. | Approval of completed designs/technical contracts or authorization to start P01. |
| A07 | 6 October 2026 | The owner selected four P04 units: global settings, native manual policies, backup portability and chooser integration, with manual exposure gated on portability. | Approval of exact fields, migration versions or command implementation; permission to execute all four in one session. |
| A08 | 6 October 2026 | The owner selected manual/on-open icon switching first. Closed-app matching is a separately authorized optional extension and does not block P12. | Selection of WorkManager/version/worker design or authorization to implement background automation. |
| A09 | 6 October 2026 | The owner explicitly requested implementation of the Focused Documentation Refinement plan, including hard versus integration dependencies and current-state corrections. | Application feature implementation, P01 execution, asset generation, builds, deployment or physical acceptance. |
| A10 | 6 October 2026 | The repository owner explicitly instructed “PLEASE IMPLEMENT THIS PLAN” for the detailed P01 implementation plan in this chat. Execute P01 only, preserving intake, style approval, two actual review prototypes, verification and final render approval. | Acceptance of the proposed style brief, generated artwork, corrected renders, P01 completion, P02, production changes or installation. |
| A11 | 6 October 2026 | The owner rejects the current UI as a final design and says r1 is not fully approved. Refine the specification only: complementary illustration and whole-UI language, explicit pattern evaluation, stronger comparison, preserved evidence and unchanged P01–P12 responsibilities. After refined specification approval, add a small artwork-only approval before actual UI integration. | Approval of r1/r2, corrected art or screens; immediate artwork generation; production implementation; a third P01 editor prototype or another milestone. |
| A12 | 6 October 2026 | The owner explicitly approves P01-style-r2 as visual direction for the next P01 checkpoint: illustration vocabulary, overall UI composition principles, visual hierarchy, reference interpretation and bounded exploration of two Meadow/two Sunrise candidates using original references. Present artwork, evaluate it and stop for selection/approval. | Final production layouts, exact tokens, detailed UX interactions, artwork candidates, completed prototypes, RN/Compose integration, P02 or production UI changes. |
| A13 | 6 October 2026 | The owner prefers S1 over S2 and M1 over M2 from the four submitted P01 artwork candidates. Exact words and preferred source hashes are preserved in [the preference record](p01-artwork-r1-preference.json). | Explicit artwork acceptance, authorization to integrate into RN/Compose, rendered UI approval, P01 completion or production changes. |
| A14 | 6 October 2026 | “I approve. Proceed” explicitly accepts the identified S1 and M1 sources for integration into the two non-shipping P01 review prototypes. [Acceptance and source hashes](p01-artwork-r1-acceptance.json). | Final rendered UI approval, P01 completion, production layouts/tokens/workflows, P02, full theme catalog or installation. |
| A15 | 6 October 2026 | “Approve” explicitly accepts P01-render-r1's actual Sunrise Agenda and Meadow alarm compositions in response to their final rendered UI checkpoint. [Acceptance and exact revision/hash](p01-render-r1-acceptance.json); [P01 handoff](../handoffs/redesign-p01.md). | Final production layouts, reusable production tokens, detailed production UX, other artwork candidates, P02 execution, physical/device acceptance, installation or distribution. |
| A16 | 6 October 2026 | “PLEASE IMPLEMENT THIS PLAN” authorizes the detailed P02 implementation plan: 16 dp tiles, Sky/Rose sample, artwork-only acceptance before integration, sample acceptance before remaining environments, complete catalog acceptance before activating shared Classic styling. [Execution record](p02/execution-authorization.json); [refined P02 plan](../plans/redesign/p02-visual-foundations.md). | Acceptance of unbuilt artwork, sample, catalog or production render revisions; workflow/persistence/notification/launcher changes; P03/P04, installation, distribution or physical acceptance. |

A03 is the owner's answer to the Meadow-alarm versus time-atmosphere question.
The original documentation request supplies A04/A05; the later review supplies A06.
A07/A08 are the owner's selected answers to the execution-unit/background questions.
A09 is the direct request to implement the documentation-refinement plan. These
records summarize human decisions and bounded planning approvals, not approval
of yet-unbuilt artifacts. A09 accepts dependency classifications at planning level;
individual contracts/partial handoffs still require their specified acceptance.

A10 supersedes A05's documentation-only execution boundary for P01, without
changing its historical meaning or authorizing another milestone. Approving owner:
repository owner in this chat. Plan ID: P01. Authorized artifact: the owner's
complete pasted implementation plan, beginning “P01 — Art Direction implementation
plan”; it preserves both mandatory design checkpoints. Intake evidence:
[6 October P01 intake](../evidence/2026-10-06-p01-intake.md). The exact proposed
brief revision is [P01-style-r1](p01-style-r1.json); it is submitted for approval,
not accepted by A10. At that submission, no accepted P01 handoff existed; A15's
later acceptance is recorded separately below.

A11 records the preceding correction. The exact request is preserved as
[Critical Visual Direction Correction](references/p01-owner-correction-2026-10-06.md),
SHA-256 `e06589961bc9719f64e409b316c3b0727da12a0cb7b666144f510ee36ecf77f9`.
Its section 13 states: “This artwork generation occurs only after the refined
specification has been approved.” It also requires artwork acceptance before actual
screen integration. This narrows the immediate A10 execution to specification refinement;
it does not cancel preserved intake or alter native requirements. The proposed successor
is [P01-style-r2](p01-style-r2.json). Its three design gates are specification, artwork-only
style and actual rendered UI. Record future explicit responses against exact hashes.

A12 records the direct owner decision: “I approve P01-style-r2 as the visual design
direction for the next P01 checkpoint.” It accepts the six-artifact bundle SHA-256
`32f913e8c46a03210dc0372527e86c102f446f4d50cf0cfe822f74c67d647728` under the
bounded scope and exclusions in [the separate acceptance record](p01-style-r2-acceptance.json).
The submitted r2 files/JSON remain unchanged; their proposal labels/ownerAccepted=false
describe the historical submission, while A12 records the later direction approval.
Original reference images remain the primary visual quality targets; the current UI
is not accepted as final. The owner directs: “Stop and wait for my approval of the
artwork candidates.” Artwork-only and actual-rendered-UI acceptance remain required.

A13 records the subsequent comparative preference: “I would say S1 is better than
S2 and M1 is better than M2”. The preferred pair is S1 (Sunrise horizon) and M1
(Meadow canopy), identified by source hashes in the separate preference record.
This does not replace A12's requirement for explicit artwork approval before
integration. Preserve the four-candidate submission and wait for acceptance of
the identified sources before beginning the actual review prototypes.

A14 answers the explicit approval question for S1/M1. It supersedes A13's pending
artwork acceptance boundary for those two sources only. Proceed with actual RN
Sunrise Agenda and Compose Meadow alarm review integration and verification;
the final rendered UI checkpoint remains mandatory. Preserve previous records
and the original candidate sources.

A15 is the owner's direct “Approve” response to the P01-render-r1 final rendered
UI approval question. It accepts bundle SHA-256
`6616bc8f98aee19982f132d9635ccc6e73d719fcf425040017d52fc4e0ba0053`,
with manifest SHA-256
`db88ea35c4633b57120d35821c45ebb27e84baa692e22337a2c7f4885ce02200`.
No additional owner conditions were stated. Together with A12 and A14, this
satisfies P01's three design checkpoints. The separate acceptance record preserves
the exact submitted files and their historical proposal labels. P02 authorization
and consolidated physical acceptance remain separate.

## Specification constraints versus recommendations

The original owner-supplied implementation specification is product input, with
adopted constraints recorded in [the master](../appearance-redesign.md): native
authority, privacy, nominal recurrence identities, manual precedence, compatibility
and alarm invariants remain requirements. This is distinct from acceptance of a
concrete persistence/interface/rollout design or rendered artifact. A02 does not
approve arbitrary later edits by linking to a living document.

WorkManager and closed-app matching were named in that earlier specification;
they were not invented during this audit. A08 changes the required rollout scope.
WorkManager is now a deferred candidate for optional P11B, with mechanism/version/
initialization/chain design open until separately refined and approved. Retained
safety constraints are conditional requirements if that extension is implemented,
not approval to introduce a dependency.

Exact schema/config/descriptor fields, migration versions, alias recovery mechanics,
classifier mappings/cache invalidation/backfill design and production tokens/art
remain subject to their plan checkpoints. Do not relabel them approved solely
because a top-level plan or execution-unit structure was accepted.

## Subsequent approvals

A16 supplies P02 execution authorization after A15's accepted P01 handoff. The
owner confirmed 16 dp reminder tiles, Sky/Rose as the expansion sample, shared
Classic styling after catalog approval, and separate artwork-only checkpoints.
These are implementation decisions, not acceptance of generated sources or
rendered designs. The source-artwork, sample and complete-catalog checkpoints in
the authorized plan remain mandatory. Production Agenda retains continuous rows
and current completion placement; later milestones own separated tiles, scenery,
saved color selection and durable session appearance. Historical P01 submissions
and their approval records remain unchanged.

The two corrected P01 representative compositions are accepted by A15. Production
palettes, the wider illustration catalog, icon adaptations, persistence contracts,
production workflow renders and launcher behavior remain subject to later gates.
Add records only after an explicit owner response.

[P01-render-r1](p01-render-review-r1.html) is the subsequent submitted actual
RN/Compose comparison package. Its [revision/hash record](p01-render-r1.json)
and [verification evidence](../evidence/2026-10-06-p01-prototypes.md) are review
artifacts. A14 did not accept these renders; A15's subsequent owner decision is
preserved in [the acceptance record](p01-render-r1-acceptance.json).

For each future record include: record ID, date, approving owner, plan ID,
artifact path and revision/hash, accepted scope, conditions, and superseded record
when applicable. Link the milestone handoff and redacted evidence. Execution
authorization and acceptance of the resulting artifact are separate decisions.
