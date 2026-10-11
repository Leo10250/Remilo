# TD-03 — App screens and remaining review

The [9 October beta corrections](../../design/current/beta-fixes.md) supersede prior
Stop, navigation, alert-first cards, browsing cover and splash density requirements.

## Contract and dependencies

TD-01 and TD-02; established native product/query/action contracts.

Read [the current design](../../design/current/README.md), [appearance policy](../../design/current/appearance-policy.md),
[product](../../product.md), [architecture](../../architecture.md) and [backlog](../../backlog.md).
The owner authorized production implementation on 9 October 2026; current corrections are recorded in [implementation decisions](../../design/current/implementation-decisions.md).

## Outcome

Apply the approved page contracts and correction notes to Agenda, Lists, Repeats, Details/Editor, Postpone, Settings and Data/Help. Extend shared components for exceptional states. Completed/Trash/Activity uses [runtime composition 05 approved for implementation](../../design/r9-runtime-composition-approval-v5.json); its required R9 composition checkpoint is closed while Android acceptance remains pending.

## Implementation

- Implement the [10 October UX refinement](../../design/current/ux-refinement.md):
  focused blank creation/keyboard handoff, one Date/Time control before alert type,
  collapsed optional Calendar event details and divider-free short menus; schedule-only
  preview, ephemeral All day restoration; alert-first conditional Details and
  truthful compact card timing/full spoken dates; Apply/Cancel filters and skipped
  chip/reset; reorganized Settings, compact alarm-check route, clock shortcuts and
  concise backup/repeat/Trash copy. Preserve captured retries, fixed scope,
  publication context, native authority and existing artwork.

- Apply the [alert experience correction](../../design/current/alert-experience.md): inline mode choices, original-alert/No alert overdue, compact statuses, one ringing Details Done and shared terminal keylines/borderless More. Preserve selection-only checkboxes, supported menus, IME/draft guards and history truth.

- Adopt Agenda / Lists / Completed / Trash roots, with Repeats secondary to Lists and secondary invoking-origin navigation. Preserve queries, filters, scroll and IME Back precedence.
- Implement neutral structural icons and one neutral reminder `event` glyph, intentional action/status roles, readable independent Event/Due/Next alert and guarded family/occurrence scope. Categories remain deferred.
- Implement one Save above the real IME with footer-aware scrolling for lower Notes/caret/errors and first-tap guarded Save; preserve stale/discard/unconfirmed operation handling.
- Carry whole-backup Restore with all new data automatic, explicit identity-conflict Keep existing/Add separate copy choices, frozen same-job retries and truthful timing/count/share/snapshot feedback.
- Preserve the explicit R9 composition 05 approval and four rejected earlier compositions. The owner's 9 October follow-up supersedes icon omission: Lists use the established neutral checklist glyph/container, without name classification or an icon picker. Reopen clears both completed and skipped without replaying elapsed alerts; Restore preserves skipped state.
- Implement the latest owner-directed R9 candidate 05 after four rejected compositions: single collection-row Reopen/Restore only in three-dot menus; explicit selection mode for Completed Reopen/Move to Trash and Trash Restore. Show 48 dp selection checkboxes only while selecting and contextual actions of at least 56 dp in a measured footer. Select all loaded never includes unloaded/newly paginated records.
- Capture selected occurrence IDs/revisions and a distinct native operation UUID per item; submit guarded commands sequentially. Report partial results truthfully, stop/freeze on an unknown reply and retry its exact command before the remaining queue. Preserve query/scope and selection recovery guards; no atomic batch or automatic rejected-item retry is introduced. The owner's subsequent instruction adds confirmed individual/selected permanent Trash deletion under the maintained page/product contract, with native identity exclusions, exact receipts and backup/recovery protection. No Empty Trash is introduced. Composition approval is recorded separately from host and physical verification.

## Acceptance and handoff

Review actual screens in all four atmospheres and both appearances; exercise dense/long content, search+IME, filters, empty/no-match, loading/retained errors, large text/TalkBack, lower Notes validation, stale/uncertain saves, recurrence exceptions and whole-backup copy/retry receipts. Verify loaded-only selection, independent row-open/selection targets, Back/Done selecting ordering, per-item identities, partial/stale outcomes, unknown-reply stop and same-item retry before continuing. Preserve the approved R9 composition 05 while observing remaining exceptional and Android interaction states; its owner approval does not establish device acceptance.

Record actual revision, delivered contracts, render/command evidence, unresolved
review conditions and pending physical observations using [the handoff protocol](../../handoffs/README.md).
Only backlog records live status. Template approval does not establish production
implementation or actual accessibility/device acceptance.
