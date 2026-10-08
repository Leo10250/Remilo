# Remaining screen refinement map

Recorded 7 October 2026, following the owner's request to identify remaining
screens and start refining them. This is design-review coverage, not another task
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

These are accepted **synthetic reference templates**, not proof that production
routes/components have been converted or that every exceptional state was reviewed.
Existing acceptance records and reference pixels stay unchanged.

## Remaining screen families and order

| Order | Family | Screens / states to refine | Existing ownership |
|---|---|---|---|
| 1 | Lists | Lists root, No list/named-list Agenda, create/rename with keyboard and duplicate-name error, remove confirmation, empty/removed list and retained-content refresh failure. | [P05](../plans/redesign/p05-agenda-and-navigation.md); current [management](../../src/app/lists/index.tsx) and [list Agenda](../../src/app/lists/[id].tsx). |
| 1 | Repeats | Active/Paused/Ended library, family details, Next/Planned dates, pause/resume, earlier unfinished/postponed occurrences and explicit occurrence/following/entire-series edit scope. | [P07](../plans/redesign/p07-details-and-repeats.md); [library](../../src/app/series/index.tsx) and [family details](../../src/app/series/[id].tsx). |
| 1 | Repeat controls | Common choices, Custom repeat intervals/selected weekdays/monthly/annual/endings, three-date preview, Apply/Cancel and invalid rule. | [P06](../plans/redesign/p06-reminder-editor.md); [Repeat form](../../src/ui/recurrence.tsx). Refined with Lists/Repeats because it authors the same families. |
| 2 | Settings / Appearance | Categorized Settings; sound preview, vibration, Snooze duration, editable tomorrow Postpone shortcuts; independent brightness/global atmosphere selection and preview; saving/error/retry. | [Settings](../../src/app/settings.tsx), [P04A](../plans/redesign/p04-fixed-appearance.md), [P09](../plans/redesign/p09-time-appearance.md). Automatic boundaries/defaults/migrations need separate policy refinement. |
| 2 | Permissions / Test alarm | Checking/Allowed/Blocked/Limited, Android Settings handoff and return, Test alarm scheduled/blocked/pending result. | Existing Settings UX. [Readiness](../../src/app/readiness.tsx) redirects to Settings; do not invent another destination. Android owns its permission screens. |
| 3 | Completed / Trash | Recorded completion/skip/deletion order, list/search filters, Include skipped, no-match/empty, Reopen/Restore, recoverable Trash and revision-safe Undo. | [P05/P07](../plans/redesign/p05-agenda-and-navigation.md), [records](../../src/app/records.tsx). |
| 3 | Activity | Recorded timeline with actual targets, empty history, long content and refresh failure. | [Activity](../../src/app/activity.tsx); P07. |
| 4 | Data / Help | Export preparation and honest share outcome; backup selection/preview/conflicts/copy choices; restoring/unconfirmed retry/blocked result; diagnostics refresh/share. | [Backup](../../src/app/backup.tsx), [diagnostics](../../src/app/diagnostics.tsx), existing product/restore contracts. |
| 5 | Remaining Agenda/detail/editor exceptions | Search+IME, filter sheet, dense long titles, no-match/loading/retained errors; Schedule details/options, all-day and independent times; zone/date/time/sound sheets; stale/conflicting draft, replaced-series recovery, discard/unconfirmed Save. | P05/P06/P07; extend approved shared components rather than designing another visual system. |
| Alongside each family | Shared interaction states | Long English/Chinese, 200% text, keyboard, focus, loading/error/uncertain operations, disabled/busy/selected states, origin return and reduced motion. | [Canonical corrections](approved-ui-r3-r4.md), P02/P12 and existing consolidated acceptance. These are state coverage, not new destinations. |

## Refinement started now

[R7 Lists/Repeats specification](r7-lists-repeats-specification.md) defines the
next layouts, flow consequences, all-eight-image appearance matrix and non-ideal
states. [The fixture brief](r7-lists-repeats-fixtures.json) gives twelve readable
screen candidates, including a paused family with an independently scheduled
exception. Their proposed presentation has **not** been accepted by the owner yet.
No new images or app implementation are produced by this refinement.

The sequence retains Agenda / Lists / Repeats as the three labeled bottom roots.
Named lists, Settings, collections and details return to their invoking origin;
editor/detail/modal workflows hide the root bar. The existing production Browse
implementation is evidence of functional behavior, not the visual replacement.

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
