# P06 Reminder Editor

## 1. Objective and user-visible outcome

Simple reminder creation becomes compact and direct while advanced timing,
recurrence, optional appearance and safe retry remain fully available.

## 2. Current relevant repository state

One-off/repeating editor, native civil/zone conversion, recurrence preview, stale
draft review, uncertain same-operation retry and native sound preview already exist.
Inspect production editor routes and `schedule.tsx`, `recurrence.tsx`, `time-zone.tsx`,
`sound-picker.tsx`, domain draft/conflict helpers and preference integration.
Optional notes currently reserve excessive space. Review forms are not production
acceptance. Consume P04/P05 and [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

Reorder common form: title, event date/time, Repeat, Alert, List, optional Notes.
Collapse unused Notes but show existing notes during edit. Keep Schedule options
for independent Due/end/all-day/zone and Alarm options for sound/vibration. Make
Alarm/Notification/No alert explicit, preserve optional P04 appearance chooser,
and make Save reachable above the keyboard. Reuse guarded drafts, native pickers,
stale review, scope selection and same-operation retry with clear feedback.

## 4. Explicit non-goals

No recurrence kernel, timing/default policy, schema, mutation authority or tone
catalog rewrite. No mandatory appearance step, AI classification implementation,
full localization, list management redesign or detail/family management work.

## 5. Prerequisites and dependencies

Hard prerequisites: P02, P05.
Integration dependencies: P04D, P09.

Require P02 primitives and P05's accepted root/origin contract, not automatically
whole-plan completion. P04D chooser and P09 transition deferral are integration
gates, not blockers for common-form/draft core work on the real existing editor.
Refine keyboard/sheet/layout decisions against actual editor behavior.
Read [appearance](../../appearance-redesign.md), [product](../../product.md),
[approvals](../../design/approvals.md) and dependency [handoffs](../../handoffs/README.md).

## 6. Relevant product requirements

Save-only durable mutation; unsaved cancellation confirmation; uncertain jobs freeze
the original command/operation ID. Stale drafts are retained for review; replaced
segments offer family reload or separate copy. Native gap/fold policy, untouched
instants, linked offsets and independent times remain exact. All-day linked Due is
end-of-day with default 9 AM alert. Sound Play/Stop never selects; native preview
is bounded, stops on close/Back/background and yields to real alarms. Bottom nav
is hidden. Appearance updates must not reset the draft or sheet state.

## 7. Approved visual references

Inherit P01/P02 art contract and [reference editor hierarchy](../../design/references/butter-periwinkle-sage.png).
Reference forms omit advanced semantics; do not remove required controls to match them.

## 8. Required design decisions

**Approved:** common form order, collapsed unused Notes, separate advanced groups,
explicit Alert modes and prominent keyboard-reachable Save.

**Proposed:** expanded Notes affordance, keyboard/action-bar and sheet reflow,
advanced timing explanation, validation/stale/uncertain/error layout and optional
appearance preview placement. Approve representative create/edit/error flows.

**Agent choices:** reuse existing draft/rule/picker APIs and encapsulated icons;
select safe focus/layout techniques from version-matched RN/Expo documentation.

## 9. Expected deliverables

Production editor layouts/states, native preview integration preserved, draft/guard
regressions, create/edit/keyboard/large-text captures, updated editor contract,
evidence, approvals and `docs/handoffs/redesign-p06.md` with transition-guard API.

## 10. Functional acceptance criteria

- Simple creation requires no new mandatory step; edit preserves notes/rules/
  appearance and untouched instants. Cancelled sheets leave applied values unchanged.
- Validate each mode, independent/coincident timings, all-day/end, pinned/floating
  zones, DST gaps/folds/later-fold preservation, three recurrence previews and scopes.
- Save returns to Agenda/originating list with acknowledgement/View; blocked/pending
  warnings remain honest. Double Save/lost reply retries the identical operation.
- Back/close honor nested sheets, keyboard, discard/stale/uncertain guards; replaced
  segments cannot be overwritten. Late preview/revision responses cannot clobber draft.
- Selection and sound preview remain independent; close/navigation/background/real
  alarm release ownership safely. Native preview failure/fallback is labeled.

## 11. Visual acceptance criteria

The title and common controls are readily scannable without an oversized optional
notes panel. Save and all controls remain reachable at 360x800 and 200% English/
Chinese text, with keyboard shown/hidden and both brightness modes. Art stays out
of field/action regions; use P02 contrast/targets, clear radio/toggle states and
stable layout during validation/loading. Host keyboard proxies are not device proof.

## 12. Verification requirements

Run shared tests and native tests for preview/conversion/bridge changes serially.
Extend draft/cancellation/conflict/retry/timing/appearance integration fixtures;
exercise actual forms and record screenshots. Actual Android keyboard/Back/native
pickers, TalkBack and audio remain P12 observations, not browser assertions.

## 13. Regression risks

Collapsing notes loses content; advanced reordering changes linkage silently;
keyboard hides Save; close stops the wrong sound; optional appearance previews
mutate saved state; transient state resets at appearance boundaries.

## 14. User approval checkpoints

Authorize/refine after P02 primitives/P05 routing capability accepted. Approve common and advanced create/edit
flows including keyboard, large text, stale review and uncertain Retry. Any changed
timing or cancellation semantics requires separate explicit product approval. Accept
P04D/P09 combined chooser/transition behavior when integrated, not as a core start gate.

## 15. Completion and handoff requirements

Hand P09 a tested edit/sheet transition-deferral boundary that retains drafts, plus
P07 editor entry/return contracts. Record accepted flow artifacts, real tests and
unobserved device behavior in standard evidence/handoff and backlog. Accepted core
capabilities may hand off separately; record and close section 5 integration gates
before whole combined acceptance. Stop at P06.

## 16. Fresh-chat execution prompt

```text
Verify accepted hard prerequisite artifacts/owner approvals and record integration gates.
Work only on P06 Reminder Editor after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p06-reminder-editor.md, approval ledger and accepted
P02 primitives/P05 routing capability, plus available P04D/P09 integration handoffs.
Inspect actual editor/draft/picker/preview/Git state; stop on missing hard approvals,
not merely outstanding integrations. Record those gates and obtain my flow approval.
Implement the compact ordered form, optional Notes, Schedule/Alarm options and
keyboard-reachable Save, preserving native timing, recurrence scopes, cancellation,
stale drafts, exact uncertain retries and preview ownership. Appearance is optional.
Publish a draft/sheet transition-deferral interface for P09. Verify actual fixture
flows, responsive/large-text captures and relevant shared/native checks; do not
claim phone keyboard/audio acceptance. Record approvals/evidence/backlog/P06 handoff.
No scheduling rewrite, deployment or next-plan execution.
```
