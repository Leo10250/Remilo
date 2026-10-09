# TD-04 — Native presentation

The [9 October beta corrections](../../design/current/beta-fixes.md) supersede prior
Stop, navigation, alert-first cards, browsing cover and splash density requirements.

## Contract and dependencies

TD-01 and TD-02; existing native session/delivery authority.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The owner authorized production implementation on 9 October 2026; current corrections are recorded in [implementation decisions](../../design/current/implementation-decisions.md).

## Outcome

Use the same four global scenes and color roles on every native full-screen alarm state, including privacy-safe pre-unlock. Preserve native actions, deadline and races; keep notifications inside Android templates.

## Implementation

- Capture resolved atmosphere/brightness at session creation; retain it through arrivals/removal/rotation/refresh/unlock and boundary changes. New sessions resolve again.
- Apply single/multiple/loading/refresh-error/action feedback anatomy and larger R6 alarm targets. Stop/quick Snooze are immediately available; Stop all is distinct; Alarm Stop completes the affected current occurrence; timeout/interruption remains unfinished.
- Use the native-safe allowlisted mirror and bundled assets without CE/React/network reads before unlock. Keep generic content and operational time; never infer public disclosure from CE availability.
- Use supported notification branding and existing native generation-safe actions/public privacy treatment. Do not add custom scenic bubbles, aliases, task-specific scenes or JS startup dependencies.

## Acceptance and handoff

Run session/deadline/stale-action/process/recreation/privacy regressions plus real signed-device initial/re-triggered notifications, cold/locked/Direct Boot, single/multiple Stop/Snooze, retained refresh errors and all eight visual pairs. Appearance failure cannot block controls, service promotion or audio.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
