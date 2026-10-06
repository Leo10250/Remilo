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

A03 is the owner's answer to the Meadow-alarm versus time-atmosphere question.
The original documentation request supplies A04/A05; the later review supplies A06.
A07/A08 are the owner's selected answers to the execution-unit/background questions.
A09 is the direct request to implement the documentation-refinement plan. These
records summarize human decisions and bounded planning approvals, not approval
of yet-unbuilt artifacts. A09 accepts dependency classifications at planning level;
individual contracts/partial handoffs still require their specified acceptance.

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

No corrected P01 renders, production palettes, illustration catalog, icon
adaptations, persistence contract, workflow renders or launcher behavior have
received recorded owner approval. Add records only after an explicit owner response.

For each future record include: record ID, date, approving owner, plan ID,
artifact path and revision/hash, accepted scope, conditions, and superseded record
when applicable. Link the milestone handoff and redacted evidence. Execution
authorization and acceptance of the resulting artifact are separate decisions.
