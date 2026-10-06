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

| Plan | Outcome | Direct dependencies |
|---|---|---|
| [P01 Art Direction](p01-art-direction.md) | Approved representative Agenda/Meadow alarm and style contract | None |
| [P02 Visual Foundations](p02-visual-foundations.md) | Approved shared/native primitives and eight light/dark environments | P01 |
| [P03 Branding](p03-branding.md) | Exact Classic production icon and reviewed palette variants | P02 |
| [P04 Fixed Appearance](p04-fixed-appearance.md) | Durable fixed palettes/manual policies, chooser and backup-v4 | P02 |
| [P05 Agenda and Navigation](p05-agenda-and-navigation.md) | Agenda/Lists/Repeats roots and secondary collection navigation | P02, P04 |
| [P06 Reminder Editor](p06-reminder-editor.md) | Compact, guarded form with reachable Save | P04, P05 |
| [P07 Details and Repeats](p07-details-and-repeats.md) | Clear state/timing hierarchy and occurrence/family management | P04, P05 |
| [P08 Native Presentation](p08-native-presentation.md) | Frozen environmental alarm sessions and supported notifications | P01, P02, P03, P04 |
| [P09 Time Appearance](p09-time-appearance.md) | Five local periods and guarded foreground changes | P04, P05, P06, P07, P08 |
| [P10 Smart Colors](p10-smart-colors.md) | Reviewed title rules, stable cached suggestions and dynamic defaults | P04, P09 |
| [P11 Launcher Personalization](p11-launcher-personalization.md) | Optional aliases and guarded best-effort matching | P03, P04, P08, P09 |
| [P12 Consolidated Acceptance](p12-consolidated-acceptance.md) | Integrated host evidence, signed artifact and owner phone acceptance | P02, P03, P04, P05, P06, P07, P08, P09, P10, P11 |

```text
Direct dependency graph (prerequisite -> dependents):
P01 -> P02, P08
P02 -> P03, P04, P05, P08, P12
P03 -> P08, P11, P12
P04 -> P05, P06, P07, P08, P09, P10, P11, P12
P05 -> P06, P07, P09, P12
P06 -> P09, P12
P07 -> P09, P12
P08 -> P09, P11, P12
P09 -> P10, P11, P12
P10 -> P12
P11 -> P12
```

## Execution and parallel work

Recommended order: P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, P12.
This is a conservative topological order, not a claim that all are executable now.
Each plan runs in a separately authorized chat using the [handoff protocol](../../handoffs/README.md).
Verify every direct dependency's accepted deliverable and evidence before coding.

P03 and P04 can overlap after P02 approval if resource/catalog ownership is agreed.
After P04/P05 merge their contracts, P06/P07 may overlap in separate modules and
P08 can work on native rendering. Shared primitives, preferences, native engine,
schema, backup and resolver changes have one integrator; do not edit those contracts
concurrently. P11 need not await P10 because it follows atmosphere, not Smart identity.
Early time/classifier kernel exploration needs explicit bounded authorization and
does not satisfy full-plan dependencies. Release-producing commands stay serial.
No independent art direction per plan and no automatic delegation is authorized.

## Approval gates

P01: approve the style brief, then both attributed actual renders/comparisons before
expansion. P02: approve a representative expansion sample, then the complete
light/dark catalog. P03: approve source fidelity and adaptations. P04: approve the
durable policy/migration contract before storage changes and the resulting chooser.
P05-P07: approve workflows; P08: approve actual native single/multiple presentation.
P09/P10: approve predictable automatic behavior/explanations; fresh dynamic defaults
activate only when both are integrated. P11: approve controls and observed launcher
behavior with cache limitations. P12: owner records consolidated physical results.
All gates identify exact artifacts in the ledger; host checks do not imply approval.

## Evidence and readiness

The [6 October reassessment](../../evidence/2026-10-06-redesign-reassessment.md)
records preserved review groundwork and limitations. The merged baseline has
[earlier host evidence](../../evidence/2026-10-05-second-refinement.md). Existing
native reports contain 99 tests/11 suites with zero failures/errors and 50 host
Compose captures; the latest complete shared run failed with temporary-module
ENOENT errors. No corrected design or new milestone is approved by those results.
Physical checks remain pending; no redesigned beta is declared verified.

P01 is a detailed next-session execution specification, subject to owner document
review and explicit authorization. P02-P12 have bounded deliverables and criteria
but require prerequisite acceptance and their own refinement/approval before
implementation. No milestone execution is authorized by this documentation task.
See [documentation validation](../../evidence/2026-10-06-redesign-planning.md) for
checks of this planning system, not application verification.
