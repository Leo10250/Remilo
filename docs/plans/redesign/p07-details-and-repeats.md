# P07 Details and Repeats

## 1. Objective and user-visible outcome

Opening a reminder explains its event, unfinished/completed status and delivery
outcome clearly; repeat families expose rules, upcoming dates and old unfinished work.

## 2. Current relevant repository state

Shared presentation already distinguishes work/delivery, consequential schedule
details and recorded Activity. Persistent Done/Reopen/Restore, eligible Postpone,
scope sheets, family query views and Active/Paused/Ended filters exist. Inspect
production detail/Repeats routes, `presentation.ts`, recurrence summary helpers,
native Agenda/family queries and serialized action handlers. P04 supplies optional
appearance policies; P05 supplies roots/origins. See [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

Recompose details around title/event range/consequential Due, one delivery/next-alert
area and persistent state actions. Separate ringing Stop/Snooze from Done. Retain
post-delivery Postpone, Schedule details, menu Activity/duplicate/destructive actions,
recoverable Trash and scope choices. Refine Repeats family rows/details, complete
rules/upcoming dates/earlier unfinished occurrences and optional scoped appearance.
Use P04 descriptors and P02 environmental art without generating a new style.

## 4. Explicit non-goals

No recurrence kernel, family identity/generation changes, invented audit history,
new scheduling semantics, tone system or full editor rewrite. No permanent purge,
automatic Trash expiry, additional palettes or classifier implementation.

## 5. Prerequisites and dependencies

Hard prerequisites: P02, P05.
Integration dependencies: P04D, P09.

Require accepted P02 primitives and P05 root/origin capability, not automatically
whole-plan completion. P04D optional chooser/scopes and P09 transitions are combined
integration gates, not blockers for detail/family core work using existing native
actions. Coordinate editor entry contracts with P06 if it runs separately;
P07 does not depend on unmerged P06 internals. Read [appearance](../../appearance-redesign.md),
[product](../../product.md), [approvals](../../design/approvals.md) and [handoff protocol](../../handoffs/README.md).
Refine actual detail/family action layout before implementation.

## 6. Relevant product requirements

Event/Due/current delivery remain independent; ordinary linked timing is concise,
coincident independent values still meaningful. Stop never means Done; terminal
targets are not future alerts. Recorded Done/Activity use actual events, not sort
fallbacks or guessed transitions. Paused/ended families retain independently
postponed/earlier unfinished occurrences. Open occurrence and manage family are
distinct. Reopen/Restore cannot replay elapsed alerts; stale actions stay fenced.

## 7. Approved visual references

Inherit P01 isolated-screen composition rules and P02 catalog with
[alarm/detail atmosphere references](../../design/references/time-of-day-and-alarms.png).
Use actual data hierarchy, not a literal alarm reference layout for a detail page.

## 8. Required design decisions

Inherit accepted P01 [component/information language](../../design/ui-composition.md)
for type, surfaces, consequential timing, recurrence summaries, actions and recovery.
Do not invent a separate visual system for details or repeats.

**Approved:** persistent Done/Reopen/Restore versus separate ringing area, eligible
Postpone after delivery, recorded Activity menu and explicit occurrence/family scope.

**Proposed:** event/due/outcome grouping, art-safe zones, family/occurrence links,
next-date presentation, menu density and empty/error/pending action states. Approve
representative stopped-overdue, ringing and paused-family flows.

**Agent choices:** use existing presentation/action eligibility/query contracts;
improve projections only if necessary and test before-pagination semantics.

## 9. Expected deliverables

Production detail/family/Repeats composition, scope/appearance/menu interactions,
preserved recorded Activity and recoverable actions, focused tests, actual render
matrix, updated contracts, evidence and `docs/handoffs/redesign-p07.md`.

## 10. Functional acceptance criteria

- Ordinary, all-day, independent/coincident, overdue, stopped/missed/timed-out,
  blocked/adjusted and unknown-reason cases show correct event/Due/next action.
- Stop/Snooze acts on captured delivery; Done acts on work; eligible Postpone remains
  after delivery ends. Custom target starts future and rejects past without mutation.
- Family Active/Paused/Ended, full rules/previews and old unfinished occurrences
  remain query-derived; open occurrence does not silently manage whole family.
- Scope edits and manual appearance inherit P04 nominal-boundary/Auto policy; no
  accidental recurrence split or alert replacement from cosmetics.
- Restore/Reopen/Undo and duplicate retain revision guards, prior state and existing
  conflict semantics. Activity contains only recorded events; empty history is honest.
- Refresh errors retain known content/Retry, loading preserves geometry, and sheets/
  uncertain operations retain origin and Back precedence. Publish guard use for P09.

## 11. Visual acceptance criteria

Title/event and consequential Due lead; one concise outcome area avoids repeated
ordinary timing/status. Art remains contextual and integrated, yielding to long
English/Chinese and 200% text. Test both brightness modes and multiple data states
at 360x800/larger/expanded; actions never overlap art/content and meet P02 contrast/
target requirements. Root navigation stays hidden on details.

## 12. Verification requirements

Run shared tests and relevant native checks serially; extend presentation/eligibility,
scope/retry/origin and family projection fixtures. Exercise actual components with
recorded Activity, stopped-overdue and paused/ended families. Physical Back/TalkBack/
Postpone/native action acceptance remains P12, separate from fixture callbacks.

## 13. Regression risks

Hiding independent timing, mislabeling terminal alerts as future, Done/Stop visual
conflation, accidentally omitting archived unfinished items, or cosmetic scope
calling scheduling edits. New imagery may crowd persistent actions at large text.

## 14. User approval checkpoints

Authorize/refine after hard artifacts. Approve stopped-overdue/ringing/family flows,
state-action comprehension, Schedule details and actual responsive render samples.
Any semantic change requires explicit product approval, not merely visual acceptance.

Accept P04D/P09 chooser/transition integration before whole combined acceptance.

## 15. Completion and handoff requirements

Publish detail/family action/layout contracts and transient transition guard usage
for P09; coordinate stable editor entry/return with P06. Record real evidence,
accepted artifacts, focused commits and pending phone observations in handoff/backlog.
Partial capabilities must identify outstanding section 5 integration gates; close
them before whole combined acceptance, without claiming a complete parent early.
Stop before automatic appearance or recurrence engine work.

## 16. Fresh-chat execution prompt

```text
Verify accepted hard prerequisite artifacts/owner approvals and record integration gates.
Execute only P07 Details and Repeats after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p07-details-and-repeats.md, approval ledger and accepted
P02/P05 capability handoffs plus available P04D/P09 integrations. Inspect actual
detail/family/query/action state and preserve dirty work; stop on missing hard
approvals, record outstanding integration gates and obtain my approval of
representative detail/Repeats workflows. Implement clear event/Due/delivery hierarchy,
persistent Done/Reopen/Restore, separate ringing Stop/Snooze, post-delivery Postpone,
recorded Activity and explicit occurrence/family/scoped appearance management.
Preserve native recurrence identity, targets, guards and backup semantics. Coordinate
editor entry with P06 and publish transient guard usage for P09. Verify actual
responsive/state fixtures and relevant shared/native checks. Record exact approvals,
evidence, backlog and P07 handoff; do not deploy or begin automatic appearance.
```
