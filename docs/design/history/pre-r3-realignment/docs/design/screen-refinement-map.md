# Remaining screen refinement map

Recorded 7 October 2026; updated 8 October 2026, following the owner's request to
identify remaining screens and start refining them. This is design-review coverage, not another task
status source; implementation status remains in [backlog.md](../backlog.md).

The [approved direction and corrections](approved-ui-r3-r4.md) govern style.
Use **all eight** images in [R3 atmospheres](remilo-r3-atmospheres/gallery.html)
for Sunrise, Sky, Evening and Night, each Light/Dark. Use the established
[product UX](../product.md) and [redesign workflows](../appearance-redesign.md)
for behavior. Image compositions do not override query, action or privacy rules.

## What is already covered

| Accepted family | What the references establish | Still needed within that family |
|---|---|---|
| R3 homepage / Agenda | Eight atmosphere/appearance compositions, tile/category/action/navigation language. | Search with keyboard, applied filters, dense/long content, no-match, refresh failure and action feedback. |
| R4/R5 Reminder details and editor | Twelve ordinary/overdue/postponed, common creation with keyboard, and independent-timing edit references, with icon/IME corrections. | Completed/skipped/Trash details, Schedule details/options, recurrence authoring, date/zone/sound pickers, stale draft/replaced series, discard and unconfirmed Save. |
| R6 native alarm and Postpone | Seven workflow templates plus four corrected themed Dark privacy-safe alarm references; full-screen states support all four themes in both appearances. | Actual shared-token matching, rendered layout/accessibility and native/device evidence; loading/action-error/timeout states need implementation review. No need to regenerate every theme/state permutation to define the shared template. |
| R7 Lists / Repeats / recurrence | Overall UI/UX outline accepted as A27; twelve associated references cover management, family states, scope and custom-repeat validation. | Decorative list-icon decision and per-image corrections; remaining component/state coverage and actual verification. Night/state permutations may inherit prior references. |
| R8 Settings / Appearance / permissions / Test alarm | A30 accepts the direction/templates shown before its response; thirteen associated references include the later R8-08 supplement. | Four-atmosphere persistence/automatic policy, identified Test retry and per-image corrections; actual preference, permission, playback, IME and device verification. |
| R10 Data / Help | A35 accepts the current r2 direction and fourteen-state Export/whole-backup Restore/Diagnostics templates; existing-reminder choices are explicit and all new data is automatic. | Per-image corrections, actual route/component implementation and measured accessibility/native/file-transfer/device verification. |

These are accepted **synthetic reference templates**, not proof that production
routes/components have been converted or that every exceptional state was reviewed.
Existing acceptance records and reference pixels stay unchanged.

## Refinement sequence and remaining screen families

R7 and R8 retain their earlier place in this sequence as accepted outline batches.
R9 retains its proposed collections/Activity brief. R10 Data/Help now has accepted templates,
followed by remaining Agenda/detail/editor exceptions. This sequence is design
coverage, not live implementation status or authorization to generate images.

| Order | Family | Screens / states to refine | Existing ownership |
|---|---|---|---|
| 1 | Lists | Lists root, No list/named-list Agenda, create/rename with keyboard and duplicate-name error, remove confirmation, empty/removed list and retained-content refresh failure. | [P05](../plans/redesign/p05-agenda-and-navigation.md); current [management](../../src/app/lists/index.tsx) and [list Agenda](../../src/app/lists/[id].tsx). |
| 1 | Repeats | Active/Paused/Ended library, family details, Next/Planned dates, pause/resume, earlier unfinished/postponed occurrences and explicit occurrence/following/entire-series edit scope. | [P07](../plans/redesign/p07-details-and-repeats.md); [library](../../src/app/series/index.tsx) and [family details](../../src/app/series/[id].tsx). |
| 1 | Repeat controls | Common choices, Custom repeat intervals/selected weekdays/monthly/annual/endings, three-date preview, Apply/Cancel and invalid rule. | [P06](../plans/redesign/p06-reminder-editor.md); [Repeat form](../../src/ui/recurrence.tsx). Refined with Lists/Repeats because it authors the same families. |
| 2 | Settings / Appearance | Categorized Settings; sound preview, vibration, Snooze duration, editable tomorrow Postpone shortcuts; independent brightness/global atmosphere selection and preview; saving/error/retry. | [Settings](../../src/app/settings.tsx), [P04A](../plans/redesign/p04-fixed-appearance.md), [P09](../plans/redesign/p09-time-appearance.md). Automatic boundaries/defaults/migrations need separate policy refinement. |
| 2 | Permissions / Test alarm | Checking/Allowed/Blocked/Limited, Android Settings handoff and return, Test alarm scheduled/blocked/pending result. | Existing Settings UX. [Readiness](../../src/app/readiness.tsx) redirects to Settings; do not invent another destination. Android owns its permission screens. |
| 3 — proposed R9 | Completed / Trash | Native completion/skip/deletion ordering, state-only collection rows, list/search filters, Include skipped, no-match/empty, Reopen/Restore, recoverable Trash and revision-safe Undo. Exact recorded times stay in details/Activity; sort fallback is not an action timestamp. | [P05/P07](../plans/redesign/p05-agenda-and-navigation.md), [records](../../src/app/records.tsx), [R9 brief](r9-completed-trash-activity-specification.md). |
| 3 — proposed R9 | Activity | Read-only occurrence timeline, actual Snooze/Postpone targets, honest empty/unknown history, long content and retained-content refresh failure. | [Activity](../../src/app/activity.tsx); P07; [R9 review states](r9-completed-trash-activity-fixtures.json). |
| 4 — accepted R10 r2 templates | Data / Help | Inline Settings Export preparation and honest native share handoff; secondary whole-backup Restore, preview entries from one file, explicitly labeled existing-reminder copy choices, restoring/frozen unconfirmed retry and truthful result; secondary Diagnostics snapshot/refresh/share. | [Settings](../../src/app/settings.tsx), [Backup](../../src/app/backup.tsx), [diagnostics](../../src/app/diagnostics.tsx), existing product/restore contracts; [R10 brief](r10-data-help-specification.md) and [A35 acceptance](approved-ui-r10-outline-acceptance.json). |
| 5 | Remaining Agenda/detail/editor exceptions | Search+IME, filter sheet, dense long titles, no-match/loading/retained errors; Schedule details/options, all-day and independent times; zone/date/time/sound sheets; stale/conflicting draft, replaced-series recovery, discard/unconfirmed Save. | P05/P06/P07; extend approved shared components rather than designing another visual system. |
| Alongside each family | Shared interaction states | Long English/Chinese, 200% text, keyboard, focus, loading/error/uncertain operations, disabled/busy/selected states, origin return and reduced motion. | [Canonical corrections](approved-ui-r3-r4.md), P02/P12 and existing consolidated acceptance. These are state coverage, not new destinations. |

## Current refinement coverage

[R7 Lists/Repeats specification](r7-lists-repeats-specification.md) defines its
layouts, flow consequences, all-eight-image appearance matrix and non-ideal
states. [The fixture brief](r7-lists-repeats-fixtures.json) gives twelve readable
screen candidates, including a paused family with an independently scheduled
exception. [A27](approved-ui-r7-outline-acceptance.json) now accepts the overall
outline, with the owner-requested list-icon implementation decision still open.
[Twelve associated images and notes](remilo-r7-lists-repeats/gallery.html) preserve
the reference bundle. [R8 Settings/Appearance/permissions/Test alarm](r8-settings-appearance-specification.md)
now refines the next family under [A28](r8-settings-appearance-intake.json), using
all eight R3 references and the established UX. Its
[thirteen-screen image brief](r8-settings-appearance-fixtures.json) now has
[associated references and corrections](remilo-r8-settings-appearance/gallery.html).
[A30](approved-ui-r8-outline-acceptance.json) accepts the R8 direction/templates
shown so far, with R8-08 a subsequent supplement and exact pixels approximate.

[A31](r9-completed-trash-activity-intake.json) now starts the proposed
[R9 Completed/Trash/Activity specification](r9-completed-trash-activity-specification.md).
The [fourteen-state image brief](r9-completed-trash-activity-fixtures.json) begins
with all eight R3 pairs. Collections return to their invoking origin and Activity
returns through details. Collection rows use state labels; only actual recorded
timestamps appear in details/Activity. Skipped Reopen retains the skipped flag.
Current Browse collection roots and collection uncertain-command retention/retry
remain explicit implementation gaps. No R9 images or new template acceptance are
claimed. [R9 evidence](../evidence/2026-10-07-r9-records-refinement.md) records the
draft checks and their limits.

[A32](r10-data-help-intake.json), dated 8 October, now starts the proposed
[R10 Data/Help specification](r10-data-help-specification.md). Its
[fourteen-state image brief](r10-data-help-fixtures.json) begins with all eight R3
pairs. Export stays in Settings; Restore backup and Diagnostics return to Settings.
Preserve identity-based conflicts, explicit copy choices, preview pagination and
frozen same-operation retry after an unconfirmed Restore. Future-alert preview
metadata is not confirmed scheduling, and retry-only acknowledgements cannot
produce invented added/preserved counts. Export/share feedback does not prove a
destination saved or sent the data. Diagnostics uses actual snapshot metadata,
retained refresh errors and native pending-reminder count scope. Android owns
document selection and sharing. [A33](r10-data-help-image-intake.json) later
authorized fourteen examples in the external projectless review bundle.
[A34](r10-restore-whole-backup-intake.json) now confirms whole-backup Restore and
authorizes documentation/UI-example clarity corrections. All new entries/lists
are automatic; existing identities are labeled **Already on this device** with
**Keep existing** / **Add a separate copy** choices, leaving originals unchanged.
New rows have no inclusion control. [A35](approved-ui-r10-outline-acceptance.json)
subsequently accepts the r2 direction and current fourteen-state gallery as
templates, with documented discrepancy corrections; exact pixels/final art and
actual accessibility/runtime/device verification remain separate.
[Original R10 evidence](../evidence/2026-10-08-r10-data-help-refinement.md)
records the original draft checks; [r2 evidence](../evidence/2026-10-08-r10-whole-backup-clarification.md)
locates the later review bundle and clarification. Next is remaining Agenda/detail/editor
exception coverage, not a new root or screen family. R9 likewise remains drafted
without generated images or acceptance.

Production implementation and actual accessibility/device evidence remain separate.

The sequence retains Agenda / Lists / Repeats as the three labeled bottom roots.
Named lists, Settings, collections and details return to their invoking origin;
editor/detail/modal workflows hide the root bar. The existing production Browse
implementation makes global Completed/Trash roots; that historical routing must
be migrated to the approved secondary-origin contract, rather than copied as the
new visual replacement.

## Deferred rather than missing

Per-reminder atmosphere/chooser and task-specific alarm artwork remain deferred.
Final art abstraction remains a later artwork review. Launcher/logo adaptation is
a separate branding task, not a missing reminder page. Calendar, cloud, iOS,
closed-app icon automation, collaboration and other unapproved destinations are
outside this refinement. Supported Android notification styling stays within the
OS-owned template; it is not a custom scenic popup/bubble page.

## Reference and verification boundary

Each future review reuses the matching R3 Light or Dark reference for **both**
canvas and elevated surfaces, plus the shared action/content/neutral roles.
Sunrise Dark is soft charcoal, Sky Dark blue-slate, Evening Dark plum-charcoal,
Night Dark navy-slate. Do not introduce a page-specific black. Synthetic images
are qualitative style evidence, not sampled production hex tokens or measured
accessibility proof. A proposed image brief, accepted pixels, actual RN/Compose
renders and physical observations remain distinct records.

[This refinement's evidence](../evidence/2026-10-07-r7-screen-refinement.md) records
the actual reference/hash/link checks and the runtime/rendering limits.
