# P05 Agenda and Navigation

**7 October 2026 visual intake:** read
[the approved R3/R4 template and corrections](../../design/approved-ui-r3-r4.md)
and use the accepted R3 homepage as the composition reference. It supersedes
conflicting older P01 visual assumptions below. One global atmosphere with
independent brightness carries across roots and secondary pages; manual reminder
appearance is deferred. Passive navigation/structural icons stay neutral, with
primary reserved for actions and explicit selection. Preserve route and timing
contracts; this design acceptance is not production or device acceptance.

**Current refinement (A25):** the [remaining-screen map](../../design/screen-refinement-map.md)
and [R7 Lists/Repeats specification](../../design/r7-lists-repeats-specification.md)
make the next proposed Lists root, named-list Agenda, metadata forms and removal
flow concrete. Use every R3 Light/Dark pair for style; keep overdue counts,
membership, origin/state and guarded commands. A27 now accepts the overall outline
with [per-image corrections](../../design/remilo-r7-lists-repeats/review-notes.json).
Decorative list icons are provisional: the owner favors omission, wants the choice
raised during implementation, and has not requested an icon picker. Prepare an
icon-free row candidate for that review. This does not execute P05 production
routing or implementation. P07 owns its family content;
P06 owns the connected recurrence controls. Older P01 reference assumptions below
do not override the current R3 direction.

## 1. Objective and user-visible outcome

Make Agenda, Lists and Repeats directly discoverable, with compact readable reminders
and secondary collections that retain context, filters and recovery actions.

## 2. Current relevant repository state

Production uses Browse modal roots, independent destination state and native query
views. Inspect `src/app`, `src/ui/navigation.tsx`, `root-state.ts`, `reminder-row.tsx`,
`src/domain/presentation.ts` and native Agenda queries. Lists/Completed/Trash are real
features, not placeholders. Compact rows/bottom navigation in review fixtures are
not proof of production completion. Consume P02/P04 handoffs and [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

Deliver labeled bottom destinations Agenda/Lists/Repeats, app-bar search/filter and
overflow Completed/Trash/Settings. Make named lists and overflow pages secondary to
their origin. Preserve keyed destination state and guarded Back precedence. Compact
Agenda/collection rows, sections, empty/loading/error states and visible contextual
actions using P02 primitives and P04 descriptors. Provide explicit list management,
No list, overdue counts and list-scoped Completed/Trash menu access.

## 4. Explicit non-goals

No editor/detail/repeat-rule redesign, engine scheduling changes, new ambiguous
Later filter, list-specific themes or replacement list identities. P07 owns the
Repeats content redesign; retain its current functional view inside the new root.

## 5. Prerequisites and dependencies

Hard prerequisites: P02.
Integration dependencies: P04A, P04B.

Require accepted P02 primitives; P04A global and P04B reminder descriptors are
integration gates, not blockers for navigation/query/row core work on the actual
compatible baseline. No production mock replaces native authority. Refine route
ownership and state migration against actual production Router before coding. Read
[product](../../product.md), [appearance](../../appearance-redesign.md),
[approval ledger](../../design/approvals.md) and dependency handoffs via [protocol](../../handoffs/README.md).

## 6. Relevant product requirements

Root switching does not accumulate tab history. Back from Lists/Repeats returns to
Agenda; secondary pages return to origin, after sheets/search/drafts/uncertain
operations. Hide bottom navigation on editor/detail. Retain independent filters and
scroll for every destination. Event drives grouping, Due drives unfinished Overdue;
changed alert targets/delivery problems/recurrence remain visible. Stop is not Done.
Lists have durable identity, explicit manage actions, No list and overdue-occurrence
counts, not unbounded future repeat counts.

## 7. Approved visual references

Inherit accepted P01 Agenda composition and P02 foundations. The
[time-of-day board](../../design/references/time-of-day-and-alarms.png) inspires
scannability, not new filter semantics. Colors supplement labeled states.

## 8. Required design decisions

Consume accepted P01 [Agenda/card/navigation language](../../design/ui-composition.md)
and [pattern evaluation](../../design/p01-pattern-evaluation.md). Leading completion
feedback remains a workflow proposal requiring failure/uncertain/Undo validation here;
P01's memory-only demonstration does not approve optimistic persistence behavior.

**Approved:** three labeled roots, overflow destinations, origin/state/Back rules,
one Add control, leading unchecked completion and restrained category glyph/accent.

**Proposed:** production route mapping, search/filter layout, overflow/menu placement,
loading skeleton geometry, list management flow and compact consequential cues.
Approve a representative populated/filtered/error workflow before broad conversion.

**Agent choices:** reuse keyed state and existing native filters/pagination; no
new navigation framework. Add focused abstractions only where they remove real duplication.

## 9. Expected deliverables

Production roots/app bars/secondary navigation, compact row/section states, Lists
management/access menus, retained collection functionality, route/interaction tests,
actual fixture renders, updated navigation contract and `docs/handoffs/redesign-p05.md`.

## 10. Functional acceptance criteria

- Switch roots repeatedly, select current root and Back; no tab history or unintended
  loss of search/filter/scroll. Editors/details omit bottom nav and return correctly.
- All transient/draft/uncertain guards precede navigation. Search Back exits search;
  query clearing remains separate. Completed/Trash return to the invoking list/root.
- Group/filter/count natively before pagination; retain paused/ended/old unfinished
  occurrences, consequential Due/delivery labels and independent postponed targets.
- Completion/Trash have visible equivalents to optional gestures and revision-safe
  Undo; stale Undo preserves later changes. Unfinished Trash confirms cancellation.
- Rename/remove list preserves scheduling; empty lists persist; list Save origin and
  membership filters remain correct. Clear filters resolves filtered empty states;
  refresh failure preserves known rows with Retry.

## 11. Visual acceptance criteria

One coherent atmosphere, near-white light-mode item surfaces and intentional dark
equivalents; title/event time scan clearly without duplicated ordinary timing.
No art/control overlaps at 360x800, larger/expanded and 200% English/Chinese text.
Bottom destinations remain labeled and >=48 dp; status never relies on color.
Verify P02 composite contrast and stable loading/action geometry.

## 12. Verification requirements

Run shared checks and native checks if query/bridge contracts change; add route,
origin/keyed-state, Back precedence, count/filter, Undo and list regression tests.
Exercise production components in controlled fixtures. Capture baseline/redesign
with identical data. Keyboard/Android Back/TalkBack remain physical P12 observations.

## 13. Regression risks

Conflating list/collection route keys, root stack growth, dropping query state,
hiding changed delivery/overdue information, completion controls colliding with
row-open actions, or menus bypassing uncertain-operation guards.

## 14. User approval checkpoints

Authorize/refine production routing after hard artifacts. Approve populated and
filtered navigation/Agenda/List/collection flows with errors and origin return.
Record exact renders and interaction scope; appearance integration needs separate
closure before combined acceptance. Device acceptance remains separate.

## 15. Completion and handoff requirements

Publish stable root/origin/state and foreground transition-guard interfaces for
P06/P07/P09. Record tests/captures, approved workflows, focused commits and explicit
device gaps in evidence/handoff; update status only in backlog. Publish an accepted
root/origin capability for P06/P07 without claiming unfinished appearance integration
complete. Close section 5 gates before combined acceptance. Do not redesign P07.

## 16. Fresh-chat execution prompt

```text
Verify accepted hard prerequisite artifacts/owner approvals and record integration gates.
Execute P05 Agenda and Navigation only after authorization. Read AGENTS.md, core
docs, redesign specification/index, docs/plans/redesign/p05-agenda-and-navigation.md,
approval ledger
and accepted P02 handoff plus available P04A/P04B integration handoffs. Inspect actual
Router/queries/Git state; stop on missing hard approvals. Appearance integrations
need not block core work; record missing gates. Obtain my route/workflow approval.
Implement Agenda/Lists/Repeats bottom roots, secondary origin-return collections,
compact rows and list access/management using approved appearance. Preserve filters,
scroll, search/Back/draft/uncertain guards, event/Due/alert semantics and revision-
safe Undo. Keep existing Repeats content for P07; no editor/detail or scheduling
rewrite. Verify focused interactions, actual responsive/large-text renders and
relevant shared/native checks. Record approvals/evidence/backlog/P05 handoff and stop.
```
