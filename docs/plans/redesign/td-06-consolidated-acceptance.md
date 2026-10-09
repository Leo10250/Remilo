# TD-06 — Consolidated acceptance

The [9 October beta corrections](../../design/current/beta-fixes.md) supersede prior
Stop, navigation, alert-first cards, browsing cover and splash density requirements.

## Contract and dependencies

Integrated TD-03, TD-04 and TD-05; TD-01/TD-02 contracts and evidence included transitively.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The owner authorized production implementation on 9 October 2026; current corrections are recorded in [implementation decisions](../../design/current/implementation-decisions.md).

## Outcome

Verify the integrated time-of-day redesign without weakening existing native reliability and deferred physical release gates. Distinguish synthetic templates, actual component renders, host results and observed device outcomes.

## Implementation

- Close current correction/remaining-review decisions and validate all four themes in Light/Dark plus System brightness behavior.
- Run appropriate shared/native/build checks for actual code changes and preserve existing alarm, recurrence, restore and upgrade regressions.
- Use one consolidated owner device checklist for large text/TalkBack/IME, appearance transitions, native sessions, permissions/audio, static identity and real data flows.
- Record signed artifact/source identity, observed passes, failures and unobserved scenarios honestly. Host completion cannot imply physical beta acceptance.

## Acceptance and handoff

Acceptance includes exact automatic edges, manual persistence, no draft reset, frozen sessions, privacy-safe themed Direct Boot, dense text/IME inputs, real notification controls, whole-backup semantics and unchanged timing/action authority. Existing G1/G2/G3 and broader OEM limitations remain; optional dynamic icons/Calendar/cloud/iOS do not become this unit's dependencies.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
