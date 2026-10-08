# TD-03 — App screens and remaining review

## Contract and dependencies

TD-01 and TD-02; established native product/query/action contracts.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The documentation PR does not execute this future production unit.

## Outcome

Apply the approved page contracts and correction notes to Agenda, Lists, Repeats, Details/Editor, Postpone, Settings and Data/Help. Extend shared components for exceptional states. Completed/Trash/Activity compositions retain their R9 draft review checkpoint.

## Implementation

- Adopt Agenda / Lists / Repeats roots and secondary invoking-origin navigation. Preserve queries, filters, scroll and IME Back precedence.
- Implement neutral structural icons, intentional action/category/status roles, readable independent Event/Due/Next alert and guarded family/occurrence scope.
- Implement one Save above the real IME with footer-aware scrolling for lower Notes/caret/errors and first-tap guarded Save; preserve stale/discard/unconfirmed operation handling.
- Carry whole-backup Restore with all new data automatic, explicit identity-conflict Keep existing/Add separate copy choices, frozen same-job retries and truthful timing/count/share/snapshot feedback.
- Keep R9 draft status and list-icon decision explicit: show omission-preferred list treatment at implementation review. Do not infer an icon picker or silently accept unreviewed compositions.

## Acceptance and handoff

Review actual screens in all four atmospheres and both appearances; exercise dense/long content, search+IME, filters, empty/no-match, loading/retained errors, large text/TalkBack, lower Notes validation, stale/uncertain saves, recurrence exceptions and whole-backup copy/retry receipts. Review R9 draft/remaining exception compositions before treating them as accepted templates.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
