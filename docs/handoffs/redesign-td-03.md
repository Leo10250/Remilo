# TD-03 — App screens and workflows

## Capture and authority

Recorded 9 October 2026 from the integrated working tree on `theme-update`, based
on `1d62f6b1bba81241120c4f31e600a3d7bbce0ae3` (design cleanup #6). This captures
source inspection and actual focused host checks before the integrator's final
commit/build record. It does not attribute an APK to that base commit. Live task
status belongs only in [backlog](../backlog.md).

The checked general screens/workflows were subsequently committed as `1cca40d`,
and the approved collections/captured bulk actions as `ef698f7`, on
`theme-update`. [TD-06](redesign-td-06.md#subsequent-source-commits) records the
complete source sequence and measured build relationship.

The implementation consumes [TD-03](../plans/redesign/td-03-app-screens.md),
[current design](../design/current/README.md), [product](../product.md),
[architecture](../architecture.md), [visual language](../design/current/visual-language.md)
and the [9 October implementation decisions](../design/current/implementation-decisions.md).
Reference identities remain R3/A18, R4–R5/A19–A20, R6/A22 with A24 replacements,
R7/A27, R8/A30 with A36 Automatic correction, and R10 r2/A34–A35. Their accepted
bundles and frozen submissions are preserved; maintained corrections govern
implementation. [Coverage](../design/current/coverage.md) identifies their scope.

R9/A31 supplies the draft Completed/Trash/Activity brief. The owner rejected the
initial implementation compositions on 9 October 2026, identifying opaque header
text/action backgrounds, an outdated toggle and overall quality against the
approved references. Revised pages remain review candidates built from shared
components; the integrator will record their next composition review separately.
Host tests do not approve their composition.

## Delivered interfaces and behavior

### Roots, scopes and retained presentation

| Surface | Interface and retained context |
|---|---|
| Agenda | Labeled Agenda/Lists/Repeats bottom navigation; Agenda/Today/Upcoming tabs; title/notes search; list, overdue and alert-problem filters; collapsible Event groups; Add; leading Done; accessible More actions. Root snapshots retain tab, search, editable filters, collapsed groups and scroll. |
| Lists | Icon-free No list first, then named lists with native overdue occurrence counts. Browsing is distinct from the explicit management destination. Scoped Agenda fixes list membership, carries Add context and provides Rename/Remove actions. Removing a list preserves reminders and offers No list. |
| Repeats | Native repeat-family rows and family details preserve current, archived, paused and ended semantics. Pause/Resume and occurrence/following/entire-series routes retain their actual native scope; a family is not inferred from unfinished occurrences. |
| Completed/Trash | Secondary collections from the invoking root or fixed list. Independent retained search, membership filter, skipped inclusion and scroll; native ordering, totals and cursor paging. Completed Reopen clears completed/skipped state; Trash Restore preserves the previous work state. Elapsed alerts remain silent. |
| Activity | Recorded occurrence history sorted newest first and grouped by device-zone day, with actual Snooze/Postpone targets. It does not fabricate whole-family or individual-field history. Unknown kinds are neutral data; refresh failure retains recorded entries. |

Agenda passes tab and filter intersections to the native query. Today admits
unfinished, nondeleted, nonskipped records whose Due or stored alert target falls
within the device-local day. Upcoming admits records whose Due or stored target
is at or after the next local midnight. A record can appear in both tabs. Event
controls Agenda grouping; a future postponed alert does not clear overdue Due.
The overdue-only and delivery-issue filters intersect the selected tab and list.
Pagination retains native cursors and first-page group totals; a retained error
does not replace already loaded rows or invent a new total.

[Navigation helpers](../../src/domain/navigation.ts) allowlist origin parameters
instead of spreading route IDs/actions. Normal stack Back remains preferred.
When the stack is absent, a child consumes its invoking Reminder context, then
family context, then Completed/Trash with fixed membership, then root/list.
Membership links capture the invoking Reminder while retaining its underlying
collection, including literal list ID `none` versus actual No list. The Reminder
context is consumed once, preventing a self-return loop. Family children capture
their family without reusing a predecessor Reminder context; the family's own
Back consumes its family context. Editor loading/error shells use this same
fallback. Search/IME and transient controls resolve before root/origin Back.

Key implementation: [Agenda](../../src/app/index.tsx),
[Lists](../../src/app/lists/index.tsx), [list management](../../src/app/lists/manage.tsx),
[Repeats](../../src/app/series/index.tsx), [family details](../../src/app/series/%5Bid%5D.tsx),
[collections](../../src/app/records.tsx), [Activity](../../src/app/activity.tsx),
[retained state](../../src/ui/root-state.ts), [navigation UI](../../src/ui/navigation.tsx).

The bounded composition correction inspected the actual R3
[Sunrise Light](../design/remilo-r3-atmospheres/01-sunrise-light.png) and
[Night Dark](../design/remilo-r3-atmospheres/08-night-dark.png) PNGs, plus R7
[Lists 01](../design/remilo-r7-lists-repeats/01-lists-sunrise-light.png),
[Work 03](../design/remilo-r7-lists-repeats/03-work-agenda-sky-light.png),
[Repeats 06](../design/remilo-r7-lists-repeats/06-repeats-evening-dark.png) and
[family 07](../design/remilo-r7-lists-repeats/07-active-family-night-light.png).
Lists and repeat-family rows now use separate opaque cards with 12 dp gaps;
repeat summary, Next/Planned date and unfinished count use separate readable lines.
Root selection uses an icon capsule and selected label; Agenda/Repeat tabs scale
and wrap without an extra selected checkmark. Family Pause/Resume and Edit use
paired action buttons. Current R7's compact 96 dp opening correction remains
authoritative over the taller generated scenic opening. These source corrections
still require actual render review; inspecting the reference is not acceptance of
the resulting component.

### Reminder, editor and transient controls

Reminder details uses shared neutral information anatomy and one neutral `event`
glyph. Semantic categories and per-reminder appearance are deferred under the
owner's recorded decision. Event, consequential Due and Next alert remain
independent. Relationship labels communicate following versus independent timing;
Scheduled describes native acknowledgement, not audibility. Postpone changes
only the next alert. Stop leaves work unfinished. Terminal details show previous
completed/skipped/unfinished state in Trash.

The editor keeps one Save footer outside form scrolling. Existing Notes remain
expanded; the common Alert area keeps independent alert timing visible. Individual
editing has read-only family context; creation and explicit family editing retain
their recurrence controls. Dirty/discard, stale revision review, replaced or
archived scope, Save as new, validation and unconfirmed Save retain the draft and
their existing native guards. Full custom-repeat preview keys include the current
draft, recurrence and zone. Apply cannot use a previous preview while the current
request is loading, failed, empty or obsolete.

[CapturedOperation](../../src/domain/operation.ts) and the shared command hook
coalesce in-flight work and preserve the captured operation ID, payload and
expected revision/generation after transport uncertainty. Retry uses that same
request. Definitive native rejection releases it for correction. Editor Save and
Details/Postpone retain their exact captured request through uncertainty; inputs,
close/navigation and retargeting remain guarded. Details membership, Repeat and
permission links are also disabled while a mutation is pending/unconfirmed;
push navigation cannot bypass the removal guard. Undo completion/deletion verifies
the returned revision against the latest record before applying its reversal.

Sheets, pickers, input focus, captured mutations and native confirmation dialogs
hold appearance until the interaction ends. The
[confirmation helper](../../src/ui/confirmation.ts) releases its hold on labeled
choices, native dismissal, default acknowledgement and presentation errors.

Key implementation: [Details](../../src/app/reminder/%5Bid%5D.tsx),
[editor](../../src/app/edit.tsx), [schedule anatomy](../../src/ui/schedule.tsx),
[recurrence controls](../../src/ui/recurrence.tsx),
[reminder row](../../src/ui/reminder-row.tsx), [shared components](../../src/ui/components.tsx).

### Settings, Data and Help

Settings separates sound/vibration defaults, future Snooze behavior, Postpone
shortcut clock times, permissions and global Appearance. Automatic/four manual
atmospheres and independent System/Light/Dark brightness use the shared resolver;
there is no per-reminder selector. Permission observations remain distinct from
successful playback. Same-operation Test retry uses
[TestAlarmOperation](../../src/domain/test-alarm.ts); another new test is offered
only after acknowledgement. Uncertain tests cannot be abandoned by navigation
or replaced by changing Settings.

Restore previews one whole backup. All new reminders, families and lists are
included automatically; existing identities offer explicit Keep existing/Add a
separate copy choices. Preview paging grows in batches of 25. Choosing a cancelled
or invalid replacement keeps the previous preview/copy choices. During uncertain
Restore, the JSON, copy selection and operation ID remain frozen by
[RestoreOperation](../../src/domain/restore.ts). Proven native pre-mutation
validation returns Rejected and allows correction; errors after mutation starts
retain uncertainty. Receipt-only retry confirms the old import without invented
counts or scheduling totals. Future-time preview wording does not claim Scheduled.

Export prepares one cache file and supports deliberate sharing of that exact file
again. It does not delete the file immediately after provider handoff; the OS can
reclaim cache later. Feedback reports opening/returning from the share sheet and
cannot confirm that a recipient saved, sent or received the backup.
[HandoffScope](../../src/domain/handoff.ts) and its
[page hook](../../src/ui/handoff.ts) prevent a late share launch after page departure
or backgrounding during preparation. An already opened handoff may background;
its acknowledgement waits for the same page to return and is discarded after
page departure.

Diagnostics retains actual snapshot observation time, operational state counts,
pending reminder projections, capabilities and schema metadata. Refresh failure
retains the previous report. Sharing captures one report rather than relabeling it
as a later refresh; request tickets prevent older completion feedback from
overwriting newer work. The report excludes titles, notes, list names, authored
schedules, occurrence IDs, credentials and raw logs; it includes observation/schema
metadata and an opaque session identifier. Backup JSON includes sensitive reminder
content and excludes appearance/settings. No automatic upload or messaging is added.

Key implementation: [Settings](../../src/app/settings.tsx),
[Appearance](../../src/app/appearance.tsx), [Restore](../../src/app/backup.tsx),
[Diagnostics](../../src/app/diagnostics.tsx),
[native import boundary](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt).

## Geometry and accessibility boundary

[FormViewport](../../src/ui/form-viewport.tsx) shares a measured usable window
region between scroll content and persistent footer. Android supplies IME overlap,
viewport and focused input/caret geometry; the pure reveal calculation clamps to
available content. Save is outside the ScrollView, whose handled-tap setting
supports form controls. Safe-area/IME clearance is applied at the region boundary.
Pages and sheets use the same geometry, and search uses it around its virtualized
content. Source inspection supports the intended first-tap Save path; it is not a
physical first-tap or composing-text observation.

The hidden swipe action has `accessible=false`, `accessibilityElementsHidden=true`
and Android `importantForAccessibility="no-hide-descendants"` until revealed.
Its appearance in a web DOM element inventory does not establish TalkBack
exposure. Alternate More actions remain labeled. Actual TalkBack order/actions,
large text, switch access, IME variants, multiline Notes selection/caret, resizing
and gesture/navigation insets still require observation on Android.

The isolated web review harness accepts recognized `reviewScene` and
`reviewBrightness` query values for all eight pairs; `reviewScale=2` holds a
presentation override through in-app navigation; `reviewText=long` supplies
bounded English/Chinese titles, Notes and list names. `reviewLostReply=1` commits
a fixture receipt then rejects the first reply once per operation ID, allowing
the actual uncertain-Save UI and exact Retry path to be reviewed. Invalid query
values and server rendering keep safe defaults. These controls live under
`verification/ui`, use only memory, and expose no native scheduling or hidden
engine API. Metro substitutes the fixture bridge and presentation wrapper only
for explicit preview web bundles; ordinary/native bundles retain a pass-through
wrapper. Browser text scaling is not an Android system-font/IME observation.

## Actual focused checks

These commands ran against the working tree on 9 October 2026. They establish
host behavior and source consistency only.

| Command | Observed result and scope |
|---|---|
| `npx vitest run src/domain/navigation.test.ts src/domain/operation.test.ts` | 2 files / 11 tests passed. Roots, No list identity, collection/family/Reminder fallback consumption, rogue route-param exclusion, membership return without self-loop, frozen/coalesced command retry. |
| `npx vitest run src/domain/editor-draft.test.ts src/domain/repeat.test.ts src/domain/restore.test.ts src/domain/test-alarm.test.ts src/domain/handoff.test.ts` | 5 files / 31 tests passed. Draft/timing preservation, recurrence controls, same-job Restore/Test retries and page/foreground handoff lifetime. |
| `node --test scripts/tests/confirmation.test.node.mjs` | 3 tests passed. Appearance holds and every confirmation-release path. |
| `node --test scripts/tests/design-review-isolation.test.node.mjs` | 13 tests passed. Preview web-only substitutions, ordinary/native pass-through, safe recognized controls, eight scene/brightness pairs, bounded English/Chinese stress content, SSR/navigation scale behavior and commit-once lost-reply receipt retry. |
| `node --test scripts/tests/design-implementation-verification.test.node.mjs` | 11 tests passed. Protected evidence/runtime edit boundary, approval/hash/copy/crop bindings, PNG lossless handling, Classic master-layer tamper detection, structural 24 dp white notification-vector checks and generated presentation consistency. |
| `npx tsc --noEmit` | Passed after scoped-list, Repeat and permission-link fixes. |
| `npx eslint src/app/index.tsx 'src/app/reminder/[id].tsx' src/app/records.tsx scripts/verify-design.mjs scripts/tests/design-implementation-verification.test.node.mjs` | Passed with no output. |
| `node scripts/verify-design.mjs` | Zero findings. Preserved reference/decision hashes, obsolete-removal/link checks, eight approved scene derivatives/copy equality, approved Classic source/export bindings and generated RN/native presentation checked. Eight preserved master-resolution limitations remain explicitly reported. |

The verifier fixture initially failed after the canonical generator gained
typography/spacing/shape/role-alias fields. Its fixture now consumes those canonical
schema fields; the generated-consistency assertion remains and passes. Earlier
Windows Vitest fork temporary-file failures were resolved by selecting the threads
pool; source assertions were retained.

## Earlier integration review — superseded candidate 04

The owner rejected runtime compositions 01, 02 and 03. Candidate 04 now removes
the ambiguous terminal completion circles. Completed and Skipped have one
text-only outlined Reopen button; Trash has an equivalent Restore button.
Each actual normal-text fixture target measured 104 × 56 CSS px. A separate
outlined 48 × 48 More target aligns with the first title line, as does the neutral
20 dp event glyph. Activity's informational event glyph is 24 dp. The
[primary-source research](../design/current/r9-action-research.md) distinguishes
Material guidance, documented task-app interactions and this implementation's
design inference. Candidate 04 was subsequently rejected; the approved candidate
05 and its current interaction evidence are recorded below.

The integrator inspected the actual shared Appearance page in all eight pairs
at 360 × 800 CSS px, and long English/Chinese in Completed, Agenda, details and
editing at a 200% fixture text override. At large text, app-bar actions move to a
separate row, preserving full title width and targets; decoration yields first.
The editor's persistent Save and Retry targets measured 328 × 72 CSS px, wholly
within the 800 px viewport at y=720. The lower Notes insertion point remained
above that footer in the browser capture. These are web observations, not actual
Android font, IME or composition evidence.

The lost-reply fixture committed the captured Save once, then returned an
uncertain result. Back remained on the editor; Retry same save resolved to the
original reminder details. Appearance lost replies likewise retain the existing
serialized preference operation and contextual Retry. The fixture cannot deliver
alarms or modify durable reminder state.

Private captures are under `verification/local/ui-redesign`: the
`final-*-light/dark.jpg` eight-pair series, `final-eight-pair-review.png`,
`r9-*-v5-full.jpg` candidate 04 renders, `editor-200-persistent-save.jpg`,
`editor-200-notes-end.jpg`, `editor-200-unconfirmed-save.jpg` and
`agenda-200-long.jpg`. A differently sized early editor capture is not used as
360 × 800 evidence. Captures preserve rendered content; comparison boards apply
the same uniform scaling to each screen.

The final source audit found no new Android workflow correctness issue. Explicit
web ARIA selected/checked attributes were added alongside native
accessibilityState for root/Agenda/Repeat tabs and repeat weekdays. Scoped lint,
typecheck and navigation/repeat tests passed (2 files / 14 tests). Final aggregate
host/native/signed preparation results will be recorded in TD-06 after the single
sequential release workflow.

## Candidate 05 — approved composition and actual interaction evidence

The latest owner instruction moved rare single-item Reopen/Restore commands into
the row's labeled More menu and authorized selected-occurrence actions. The owner
then answered **“Approve composition for implementation”** for the actual normal
and selection comparisons. The [approval record](../design/r9-runtime-composition-approval-v5.json)
binds the exact question/answer and both shown image hashes. Candidates 01–04 stay
rejected. This approval concerns composition; actual Android acceptance is separate.

Normal terminal collection rows now omit inline Reopen/Restore and leading work
controls. More remains an outlined 48 dp target aligned with the first title line;
the neutral event glyph is informational. Toolbar More → Select reminders exposes
selection-only checkboxes with separate row-open targets, selected counts and
persistent Reopen/Move to Trash or Restore actions of at least 56 dp. Activity's
24 dp trash/history glyph is display-only. Terminal details retains its established
action footer. Select all loaded names its loaded-only scope; pagination does not
automatically add new selections. Query and membership remain frozen in selection
mode, and selection/scroll is keyed independently for fixed/global collections.

Each batch captures command kind, deduplicated occurrence IDs, expected revisions
and a distinct operation UUID per item. Existing native commands run sequentially.
Only definitive replies advance the queue; a lost reply pauses at the exact child
and Retry retains that child's identity/payload before continuing. Confirmed
prefixes are not repeated. Structured rejections and alert-registration warnings
remain separate outcomes; there is no atomic rollback, permanent purge or invented
batch Undo. Detailed feedback and the unresolved captured title live in the scroll
body; the fixed footer retains count and Retry. After all definitive results,
selection clears while the summary and remaining collection stay visible.

The six focused bulk domain tests pass: capture/eligibility/unique identities,
frozen deduplication, rapid-tap single-flight sequencing, commit-once lost replies,
exact child retry with preserved prefixes, and truthful rejection/registration
outcomes. The bulk/navigation/presentation/operation run passed 26 tests. Scoped
lint/typecheck passed. The final aggregate run passed 115 shared, 75 tooling and
120 native tests with lint and signed release assembly, recorded in
[TD-06](redesign-td-06.md).

The development Metro preview stalled after reloads. A source audit found no
concrete render-loop cause; that was not attributed to native behavior. The
integrator then exported the same opt-in memory-only fixture components with
`REMILO_UI_PREVIEW=1` and reviewed the localhost-only static export. Actual browser
observations at 360 × 800 CSS px included:

- Two selected Completed/Skipped records: the first committed lost reply left
  “Confirmed: 0 of 2 reopened”, a captured unresolved title and disabled competing
  controls. Back remained on the same page. Retry acknowledged the first operation,
  then paused on the second lost reply with “Confirmed: 1 of 2 reopened”. A second
  Retry showed “2 of 2 reopened”, cleared selection and retained the empty collection.
- Two selected records moved to Trash; the selected count cleared with
  “2 of 2 moved to Trash”. Selection Back exited mode before origin Back returned
  to Agenda. Trash reached through the UI retained both prior Completed/Skipped
  states. Restoring those two showed “2 of 2 restored” and left the unselected
  unfinished reminder in Trash.
- Long English/Chinese at 200% fixture text in Night/Dark: the short action and
  Retry targets each measured **328 × 72 CSS px**, with the lower action/Retry at
  **y=712–784**. The unresolved captured title remained accessible in the scroll
  body. Back remained guarded during uncertainty; Retry resolved the captured item.
- All eight Appearance pairs were captured at 200% fixture text and 360 × 800
  CSS px. Their controls wrap on opaque matching surfaces; decoration yields first.
  These supplement the eight normal-text scene/crop captures above.

Private full-screen captures are under `verification/local/ui-redesign`:
`r9-completed-final05.jpg`, `r9-trash-final05.jpg`, `r9-activity-final05.jpg`,
`r9-completed-selection-final05.jpg`, `r9-trash-selection-final05.jpg`,
`r9-bulk-unknown-first-final05.jpg`, `r9-bulk-unknown-second-final05.jpg`,
`r9-bulk-confirmed-final05.jpg`,
`r9-bulk-delete-confirmed-final05.jpg`, `r9-bulk-restore-two-final05.jpg`,
`r9-selection-200-final05.jpg`, `r9-bulk-unknown-200-final05.jpg`,
`r9-bulk-unknown-title-200-final05.jpg` and the
`appearance-200-*-*-final05.jpg` series. Comparison boards use unchanged
full viewport screenshots at uniform scaling:

| Review | SHA-256 |
|---|---|
| `r9-composition-review-v5.png` | `cd44f1eb15f7cf59c74ff2a8b193f63f2a630fc1d6cf4dc8010ebdd3a3f5fd4f` |
| `r9-selection-review-v5.png` | `13afc68d79013f005b267229c5851b1f7fa6f1eedf9dff09c420c5ffc9cd4db4` |
| `appearance-eight-pair-200-review.png` | `c3bf6520f1b9189c58d88be47a6c9a8a6250554005548243c2d153525f74fa11` |

## Remaining evidence conditions

Final aggregate checks and the signed artifact are recorded in TD-06; this handoff
records actual fixture identities and the owner's R9 composition approval.
No build, installation, release distribution, provider/OEM observation, native
keyboard/composition observation, measured TalkBack result or audible alarm result
is asserted by this capture. The owner deferred interactive phone testing to the
consolidated run; [verification](../verification.md) and
[device acceptance](../device-acceptance.md) define its separate evidence boundary.
Exceptional/large-content/large-text physical review remains separate from the
accepted R9 composition and passing host checks above.
