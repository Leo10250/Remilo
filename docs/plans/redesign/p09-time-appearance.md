# P09 Time Appearance

## 1. Objective and user-visible outcome

Opted-in Remilo atmosphere follows five predictable local periods independently of
brightness, without changing drafts, scroll, reminder identity or ringing canvases.

## 2. Current relevant repository state

Only review fixtures currently have time-band resolution. Existing production
foreground minute refresh is presentation-only, not alarm scheduling. P04 provides
native settings/resolver and legacy marker; P05-P07 provide route/transient guards;
P08 freezes native sessions. Inspect real lifecycle and preferences before adopting
any fixture helper. See [baseline](../../evidence/2026-10-06-redesign-reassessment.md).

## 3. Scope

Implement native five-period/next-boundary resolution, versioned descriptors and
Time of day controls. Reconcile foreground boundary/resume/time/zone changes; defer
visible transition during sheets/edit until dismissal without replacing their state.
Resolve authored event-band identity for timed reminders using P04 precedence.
Keep reduced-motion updates instantaneous and no closed-app cosmetic worker yet.

## 4. Explicit non-goals

No classifier, Daily Mix, weather/location/sensors, JS alarm timer, WorkManager,
exact cosmetic alarm, icon matching or fresh dynamic defaults activation without P10.
No reinterpretation of event times, independent targets or all-day midnight bands.

## 5. Prerequisites and dependencies

Dependencies: P04, P05, P06, P07, P08.

Require accepted resolver/settings/legacy contract, actual navigation/editor/detail
guard interfaces and frozen native session behavior. Refine lifecycle/transition
ownership against dependency handoffs; do not assume a general route flag is enough.
Read [appearance](../../appearance-redesign.md), [architecture](../../architecture.md),
[approvals](../../design/approvals.md) and [handoff protocol](../../handoffs/README.md).

## 6. Relevant product requirements

Local bands are half-open: 06:00-10:00 Sunrise, 10:00-16:00 Sky, 16:00-20:00 Peach,
20:00-23:00 Lavender, 23:00-06:00 Mist. System/Light/Dark remains independent.
Manual occurrence/following/family choice wins; P10 adds confident content before
event time. All-day uses content/global, never arbitrary midnight. Pinned reminders
use named zone; floating occurrences use their resolved zone. Snooze/Postpone changes
delivery only and cannot recolor identity. Existing installs remain fixed/Classic
automation-off unless opted in. Fresh time+Smart defaults wait for integrated P10.

## 7. Approved visual references

Use P01/P02 approved environments and
[time-of-day inspiration](../../design/references/time-of-day-and-alarms.png).
Printed reference labels do not override the approved five-band policy or brightness.

## 8. Required design decisions

**Approved:** exact five bands, brightness independence, event identity/zone rules,
transition deferral and reduced-motion behavior; no scheduling effect.

**Proposed:** pending-transition coalescing and apply point for each transient state,
system clock/zone reconciliation, appearance-page previews and error/retry feedback.
Approve boundary examples and UI guard behavior before integration.

**Agent choices:** native time abstractions and foreground-only wake-up/subscription
mechanism using existing lifecycle; no JS/native engine alarm ownership transfer.

## 9. Expected deliverables

Native period/next-boundary resolver, foreground reconciliation/deferral integration,
time-mode previews/controls, authored reminder-band resolution, deterministic clock/
zone tests, actual transition captures, evidence and `docs/handoffs/redesign-p09.md`.

## 10. Functional acceptance criteria

- Test exact edges, midnight, DST, forward/back clock changes, zone travel and long
  background absence; resolve current period, not replay missed transitions.
- Sheets/edit/stale/uncertain drafts retain data, focus and scroll. Coalesce boundary
  changes and apply latest valid atmosphere only on safe dismissal/resume.
- Manual/Auto/unknown-ID/all-day/pinned/floating cases resolve correctly; future items
  keep their event identity inside today's atmosphere. Snooze/Postpone never recolors.
- Brightness changes remain independent; reduced motion has no animated transition.
  Frozen alarm canvas survives changes; no targets/generations/registrations change.
- Legacy missing-settings cases keep opt-in behavior; fresh defaults remain fixed
  until P10's combined activation. Publish idempotent period resolver for P11.

## 11. Visual acceptance criteria

All five environments use approved P02 roles and remain coherent in light/dark.
Transitions never flash unreadable intermediate colors or reset layout. Verify actual
360x800/larger and 200% English/Chinese compositions, grayscale, reduced motion and
composite contrast. Per-item accents must not compete with the global atmosphere.

## 12. Verification requirements

Run shared and relevant native tests/lint/assembly serially. Add pure controlled
clock/zone period tests and foreground guard/retry races; compare operational state
before/after changes. Actual lifecycle/large-text/reduced-motion phone behavior is
P12 evidence. No background cosmetic scheduling, device installation or polling.

## 13. Regression risks

Clock boundary drift, half-open off-by-one errors, using delivery instead of event
time, drafts resetting through provider remounts, stale pending transitions, or
changing the native canvas on unlock/brightness refresh.

## 14. User approval checkpoints

Authorize/refine after prerequisites. Approve boundary/zone/deferral examples and
actual atmosphere transitions. Do not activate fresh-install time+Smart defaults
until P10 completes its combined approval and regression gate.

## 15. Completion and handoff requirements

Publish tested period/next-boundary API and lifecycle reconciliation rules to P10/P11,
legacy/default activation contract and accepted transitions. Record actual checks,
unchanged-operation evidence, approvals and device gaps in handoff/backlog. Stop at P09.

## 16. Fresh-chat execution prompt

```text
Verify all listed prerequisite completion, accepted handoffs and owner approvals.
Work only on P09 Time Appearance after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p09-time-appearance.md, approval ledger and accepted
P04/P05/P06/P07/P08 handoffs. Inspect native resolver/settings and actual lifecycle/
draft/sheet guards; stop on missing prerequisites. Refine and obtain my approval of transition
policy, then implement five exact local bands, native event-band identity and
foreground boundary/resume/clock/zone reconciliation without draft/scroll resets.
Preserve brightness independence, manual/Auto precedence, all-day and zone policy,
frozen native sessions and all targets/generations. Defer during transient editing;
respect reduced motion. Keep legacy automation opt-in and fresh defaults fixed
until P10. No classifier, icon/background work or alarm timers. Verify controlled
time/zone and guard races plus shared/native checks, record approvals/evidence/
backlog/P09 handoff, and stop without deployment or next-plan execution.
```
