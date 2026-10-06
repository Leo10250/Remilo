# Remilo redesign roadmap

## Vision and authority

A coherent, softly illustrated Remilo atmosphere supports clear everyday scanning;
individual details/alarms receive richer contextual environments. The exact supplied
Classic icon is the identity. Workflows improve without changing offline native
alarm ownership, recurrence, timing, privacy or backup guarantees.

Read the approved [product contract](../../product.md), [redesign specification](../../appearance-redesign.md),
[architecture](../../architecture.md), [verification](../../verification.md),
[approval ledger](../../design/approvals.md) and [supplied references](../../design/references/README.md).
The specification owns requirements; these plans own execution scope; only
[backlog](../../backlog.md) owns live status. Earlier AR-00-06 planning is superseded,
not evidence that its approval gates passed.

## Plan index and dependencies

**Hard prerequisite:** an accepted artifact/contract required to start the bounded
work, not necessarily completion of its entire parent plan. **Integration dependency:**
wiring and regression evidence required before accepting the combined behavior;
it does not block independent core work using the actual compatible baseline.
Every session still needs explicit execution authorization. A11 adds a P01 artwork-only
gate between refined specification approval and integration. Milestone dependency edges
remain unchanged. Missing integration gates must be recorded, never silently waived.

| Plan | Outcome | Hard prerequisites | Integration dependencies |
|---|---|---|---|
| [P01 Art Direction](p01-art-direction.md) | Approved illustration/UI language, artwork selection and two Agenda/Meadow representatives | None | None |
| [P02 Visual Foundations](p02-visual-foundations.md) | Approved shared/native primitives and eight light/dark environments | P01 | None |
| [P03 Branding](p03-branding.md) | Exact Classic production icon and reviewed palette variants | P01 | P02 |
| [P04 Fixed Appearance](p04-fixed-appearance.md) | Four units: global settings, internal policies, portability, chooser | P02 | P06, P07 |
| [P05 Agenda and Navigation](p05-agenda-and-navigation.md) | Agenda/Lists/Repeats roots and secondary collection navigation | P02 | P04A, P04B |
| [P06 Reminder Editor](p06-reminder-editor.md) | Compact, guarded form with reachable Save | P02, P05 | P04D, P09 |
| [P07 Details and Repeats](p07-details-and-repeats.md) | Clear state/timing hierarchy and occurrence/family management | P02, P05 | P04D, P09 |
| [P08 Native Presentation](p08-native-presentation.md) | Frozen environmental alarm sessions and supported notifications | P02, P04A | P03, P04B, P09, P10 |
| [P09 Time Appearance](p09-time-appearance.md) | Five local periods and guarded foreground changes | P04A | P04B, P05, P06, P07, P08, P10 |
| [P10 Smart Colors](p10-smart-colors.md) | Reviewed title rules, stable cached suggestions and dynamic defaults | P04A | P04B, P04C, P04D, P09 |
| [P11 Launcher Personalization](p11-launcher-personalization.md) | Manual variants and theme matching on open/resume | P03, P04A | P09 |
| [P12 Consolidated Acceptance](p12-consolidated-acceptance.md) | Integrated host evidence, signed artifact and owner phone acceptance | P02, P03, P04, P05, P06, P07, P08, P09, P10, P11 | None |

The listed P02 outputs are its approved primitives/catalog contract; P05 supplies
an accepted root/origin contract, and P03 supplies reviewed variants for P11.
P12 requires all mandatory outputs and all applicable integration gates, not merely
their contracts. P04's parent completes only after its four units. Chooser placement
can first use the existing editor/detail; later P06/P07 integration is a release
gate when those redesigned routes are present, not a circular start-order edge.

| Execution unit | Hard prerequisites | Boundary |
|---|---|---|
| P04A | P02 | Global settings, descriptors, legacy handling and Appearance page |
| P04B | P04A | Internal/test-only manual policies and native operations |
| P04C | P04B | Backup-v4 portability; only then may manual mutations be exposed |
| P04D | P04C | Optional chooser, draft preview and production UI integration |
| P11B (optional) | P11, P09 | Separately authorized background extension; mechanism undecided |

```text
Hard prerequisite graph (accepted artifact -> work):
P01 -> P02, P03
P02 -> P04A, P05, P06, P07, P08, P12
P03 -> P11, P12
P04A -> P04B, P08, P09, P10, P11
P04B -> P04C
P04C -> P04D
P04D -> P04 (aggregate)
P04 -> P12
P05 -> P06, P07, P12
P06 -> P12
P07 -> P12
P08 -> P12
P09 -> P12, P11B (optional)
P10 -> P12
P11 -> P12, P11B (optional)
```

Integration relations can be mutual and are not scheduling edges in this graph.
They close through identified combined tests/approvals before whole-scope acceptance.
P11B has no edge to P12 and cannot block the first consolidated run.

## Execution and parallel work

Conservative order: P01, P02, P03, P04A, P05, P04B, P04C, P04D, P04 aggregate,
P06, P07, P08, P09, P10, P11, mandatory integration closure, P12. P04's aggregate handoff
follows its four accepted units. This is an option, not a new whole-plan start gate.
Each bounded session uses the [handoff protocol](../../handoffs/README.md) and its
own authorization; verify required artifacts and approval scope before coding.

Classic P03 work can follow P01 while P02 proceeds; variants await P02 colors.
P05 need not await all P04. P06/P07 can start from P05's accepted route contract.
After P04A, native presentation, time and classifier core work can proceed without
waiting for every redesigned screen. P11 core need not await P08 or P09; time-mode
matching still requires P09 integration. Use accepted partial capability handoffs,
not production mocks or invented interfaces. Shared primitives, preferences, engine,
schema, backup and resolver edits have one integrator and are not concurrent.
Release-producing commands stay serial. No independent art direction or automatic
delegation is authorized; partial work cannot claim whole-plan completion.

## Approval gates

P01: approve complementary illustration/UI language, then artwork-only candidates before
integration, then both attributed actual renders/comparisons before
expansion. P02: approve a representative expansion sample, then the complete
light/dark catalog. P03: approve source fidelity and adaptations. P04: jointly approve
policy/portability semantics before storage changes, then accept each bounded unit.
P04B cannot expose manual mutations before the P04C portability gate; P04D adds UI.
P05-P07: approve workflows; P08: approve actual native single/multiple presentation.
P09/P10: approve predictable automatic behavior/explanations; fresh dynamic defaults
activate only when both are integrated. P11: approve core controls/alias recovery
with cache limitations; P11B needs separate scope and mechanism approval. P12:
owner records consolidated physical results, excluding unimplemented optional work.
All gates identify exact artifacts in the ledger; host checks do not imply approval.

## Evidence and readiness

The [6 October reassessment](../../evidence/2026-10-06-redesign-reassessment.md)
records preserved review groundwork and limitations. The merged baseline has
[earlier host evidence](../../evidence/2026-10-05-second-refinement.md). Existing
recorded native reports contain 99 tests/11 suites with zero failures/errors and 50
host Compose captures; the last recorded complete shared run failed with temporary-
module ENOENT errors. These are historical results, not verification of current HEAD.
At refinement intake, HEAD `9195784` is clean and tracks the previously uncommitted
review code/assets. No corrected design or new milestone is approved by that commit.
Physical checks remain pending; no redesigned beta is declared verified.

The owner reviewed and preserved the planning structure and authorized this focused
documentation refinement. P01 remains a detailed next-session specification needing
separate execution authorization. P02-P12 have bounded deliverables and criteria
but require prerequisite acceptance and their own refinement/approval before
implementation. No milestone execution is authorized by this documentation task.
See [documentation validation](../../evidence/2026-10-06-redesign-planning.md) for
checks of this planning system, not application verification.

The later owner instruction A10 separately authorizes P01 execution under its
existing style-brief and rendered-screen gates. See the
[attributed intake](../../evidence/2026-10-06-p01-intake.md) and
[proposed brief](../../design/art-direction.md). That instruction does not authorize
P02 or accept a design artifact; the preceding documentation history remains intact.

The latest A11 [critical correction](../../design/references/p01-owner-correction-2026-10-06.md)
requests specification-only refinement and an additional artwork-only gate. The
[r2 UI language](../../design/ui-composition.md), [art brief](../../design/art-direction.md)
and [pattern evaluation](../../design/p01-pattern-evaluation.md) guide later milestones
once accepted. Editor/settings/notifications are specified, not implemented under P01.
Recommend a bounded editor study at P06 intake; moving it into P01 needs explicit scope
approval. No P01–P12 responsibilities or hard/integration dependencies are reassigned.
