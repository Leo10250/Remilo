# TD-02 — Global Appearance

## Contract and dependencies

TD-01 shared roles/assets; existing native settings/controller baseline.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The owner authorized production implementation on 9 October 2026; current corrections are recorded in [implementation decisions](../../design/current/implementation-decisions.md).

## Outcome

Add one global atmosphere selection: Automatic / Sunrise / Sky / Evening / Night, separate from existing System/Light/Dark brightness. Implement the approved local-clock policy and a minimal native-safe device-protected appearance mirror.

## Implementation

- The [10 October UX refinement](../../design/current/ux-refinement.md) names the
  independent groups Color mode and Atmosphere, with Match device and By time of
  day labels (stored values unchanged). Add canonical two-tone swatches, shared
  resolver Now and a collapsed localized Daily schedule; retain one captured
  recovery for both preferences. No new scene, palette or lifecycle timer.

- Settings Appearance uses one five-value dropdown with explicit selection and existing serialized auto-saving/error/retry behavior.
- Resolve Sunrise 06:00–10:00, Sky 10:00–17:00, Evening 17:00–21:00, Night 21:00–06:00 using current device-local time/zone. New/missing selection defaults Automatic; preserve brightness and persistent manual overrides.
- Reconcile foreground boundaries/resume/time/zone changes; coalesce automatic updates during transient editing and preserve drafts, focus, caret, scroll and captured operations.
- Document and implement native-owned preference/mirror ordering with only global selection and brightness. Pre-unlock needs no CE, React, network or private content. No per-reminder settings, classifier, backup-v4 or cosmetic background scheduling.

## Acceptance and handoff

Test every inclusive boundary, midnight, DST, manual persistence, missing/unknown preference fallback, upgrade brightness preservation, clock jumps, timezone changes and long absence. Verify native mirror failure/privacy, reduced motion, same-operation settings retries and new-session resolution without modifying alarm targets/generations.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
