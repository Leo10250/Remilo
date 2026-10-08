# P09 Time Appearance

**7 October 2026 policy intake override:** read
[the approved R3/R4 template and corrections](../../design/approved-ui-r3-r4.md).
The accepted preview scenes are Sunrise, Sky, Evening and Night, each with
independent brightness and one global atmosphere across screens. They do not
approve replacement automatic switching boundaries, migrations or defaults.
The old five-period table and authored-event/manual item-identity assumptions
below remain earlier planning requiring refinement; do not silently convert them
to a four-period policy or implement deferred task-specific appearance. Preserve
timing, draft/scroll and native privacy/action contracts while refining this plan.

**R8 review input (A28):** [the proposed Appearance page](../../design/r8-settings-appearance-specification.md)
separates four fixed scene choices from System/Light/Dark. It intentionally shows
no enabled Automatic toggle or invented next-switch time. This does not remove
the planned time-of-day feature or accept a replacement policy: reconcile the old
five bands against four global scenes, defaults/opt-in/legacy paths, clock/zone
and transient/session behavior at the P09 policy checkpoint. R8's held review
clock and chosen scenes are not new automatic boundary evidence.

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

Hard prerequisites: P04A.
Integration dependencies: P04B, P05, P06, P07, P08, P10.

Require P04A's accepted resolver/settings/legacy contract for core period work.
P04B manual precedence, P05-P07 redesigned transient guards, P08 frozen presentation
and P10 combined defaults are integration gates. Core can use actual baseline guards;
do not enable a combined path until its corresponding gate passes. Refine lifecycle/transition
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

Apply accepted P01 [settings/selection language](../../design/ui-composition.md)
alongside P02 primitives: concise radio explanations, visible non-color selection,
independent brightness and honest applied/pending/failure states. Reference labels do
not introduce weather/Daily mix behavior.

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

Authorize/refine core after P04A hard contract. Approve boundary/zone/deferral examples and
actual atmosphere transitions. Do not activate fresh-install time+Smart defaults
until P10 completes its combined approval and regression gate. Accept manual,
redesigned-screen and frozen-native integration before enabling those combined paths.

## 15. Completion and handoff requirements

Publish tested period/next-boundary API and lifecycle reconciliation rules to P10/P11,
legacy/default activation contract and accepted transitions. Record actual checks,
unchanged-operation evidence, approvals and device gaps in handoff/backlog. Accepted
core period capabilities may hand off before redesigned screens; record section 5
gates and close them before whole combined acceptance. Stop at P09.

## 16. Fresh-chat execution prompt

```text
Verify accepted hard prerequisite artifacts/owner approvals and record integration gates.
Work only on P09 Time Appearance after authorization. Read AGENTS.md, core docs,
redesign specification/index, docs/plans/redesign/p09-time-appearance.md, approval ledger and accepted
P04A capability plus available P04B/P05/P06/P07/P08/P10 integrations. Inspect native
resolver/settings and actual lifecycle/draft/sheet guards; stop on missing hard
approvals, record integration gates and obtain my approval of transition
policy, then implement five exact local bands, native event-band identity and
foreground boundary/resume/clock/zone reconciliation without draft/scroll resets.
Preserve brightness independence, manual/Auto precedence, all-day and zone policy,
frozen native sessions and all targets/generations. Defer during transient editing;
respect reduced motion. Keep legacy automation opt-in and fresh defaults fixed
until P10. No classifier, icon/background work or alarm timers. Verify controlled
time/zone and guard races plus shared/native checks, record approvals/evidence/
backlog/P09 handoff, and stop without deployment or next-plan execution.
```
