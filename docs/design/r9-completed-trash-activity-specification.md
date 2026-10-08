# R9 — Completed, Trash and Activity

Revision 1 · 7 October 2026 · **Proposed layouts and image brief; not yet accepted.**

[A31 intake](r9-completed-trash-activity-intake.json) records the owner's
continuation on this screen family and requirement to use all R3 images for color
and style while retaining established UX. [Fourteen representative captures](r9-completed-trash-activity-fixtures.json)
are prepared for the next image review. This task generates no new images and
implements no product behavior. P05 owns collection routing/presentation; P07
owns terminal details, Activity and content actions. Task status remains in
[backlog](../backlog.md).

## Authority and visual references

Use [the canonical corrections](approved-ui-r3-r4.md), the accepted R4–R8 shared
components and [product](../product.md)/[architecture](../architecture.md)
contracts. These are secondary pages of the same globally themed product, with
independent Light/Dark/System brightness. All eight R3 PNGs were inspected.

| Atmosphere | Light reference and roles | Dark reference and roles |
|---|---|---|
| Sunrise | [01](remilo-r3-atmospheres/01-sunrise-light.png): peach/gold sunrise and lake/conifers; warm off-white canvas, white raised surfaces, burnt-orange primary/light content. | [02](remilo-r3-atmospheres/02-sunrise-dark.png): same sunrise; soft charcoal canvas/raised charcoal, pale-apricot primary/dark content. |
| Sky | [03](remilo-r3-atmospheres/03-sky-light.png): clear blue clouds, lake/green banks; pale cool-blue canvas/white surfaces, saturated-blue primary/light content. | [04](remilo-r3-atmospheres/04-sky-dark.png): **daytime** clouds/lake; blue-slate canvas/raised slate, pale-sky-blue primary/dark content. |
| Evening | [05](remilo-r3-atmospheres/05-evening-light.png): coral/rose sunset, sun/reflection; pale rose/off-white canvas/white surfaces, muted-plum primary/light content. | [06](remilo-r3-atmospheres/06-evening-dark.png): same sunset; plum-charcoal canvas/raised plum, pale-rose primary/dark content. |
| Night | [07](remilo-r3-atmospheres/07-night-light.png): crescent/stars, moonlit lake; icy-blue canvas/white surfaces, deep-blue primary/light content. | [08](remilo-r3-atmospheres/08-night-dark.png): same moonlit scene; navy-slate canvas/raised navy, pale-periwinkle primary/dark content. |

Match both shared canvas and elevated surfaces. No page-specific black, sampled
PNG hex values or glass reading planes. Final art abstraction remains deferred;
reuse the selected scene/crop policy, rather than invent history-specific scenery.
Every collection, details page, sheet, loading/error state and feedback panel
supports every pair. The first eight captures exercise each pair once; scenes are
manually selected at a held review clock, not automatic switching examples.

## Shared layout and origin navigation

- One readable portrait screenshot per capture, reviewed at 360 × 800 dp.
  Use a compact opening approximately 96 dp below the status inset, including
  a 56 dp Back/title toolbar and a shallow scene crop. No tall homepage hero,
  repeated Remilo headline or motivational copy. Artwork yields first under
  large text, IME, modal or constrained height.
- Collections are secondary overflow destinations from Agenda / Lists / Repeats;
  return to the invoking root. A list-scoped collection returns to its named
  list or No list. Details returns to that collection; Activity returns to those
  details with the parent context intact. No bottom root bar or creation FAB.
- Preserve independent query, editable membership, Include skipped and scroll
  state for each global collection and each fixed-list collection. Fixed scope
  always wins: a named-list/No list page cannot be broadened by Clear filters.
- Back resolves the open sheet and IME/transient search state before origin
  navigation, subject to a pending/unconfirmed command guard. Exiting search
  retains its query; clearing text is a separate deliberate action. Restore the
  same destination snapshot when returning from details or Activity.
- Use 16 dp gutters/corners, 16 sp body and 14 sp support on opaque reading
  surfaces. Rows grow for long English/Chinese titles, metadata and state text.
  Keep at least 48 dp targets and 56 dp prominent actions; do not shrink text
  or squeeze every row into one screen. Pagination remains visible below content.
- Toolbar/More/filter/timing glyphs and support text are neutral shared roles.
  Category identity stays stable across themes. Completed uses the established
  success meaning; Skipped stays neutral with an explicit label. State/selection
  also use text/icon/accessible state. Historical content remains readable at
  full content contrast, with no whole-row fading or automatic strike-through.
- Separate row-open, labeled Reopen/Restore and More targets. Never make a
  checkmark or completion-like circle mean Restore. Keep optional swipe reveal
  plus tap only where an equivalent visible action exists.

Current global collections still use Browse roots. The approved secondary-route
conversion, origin capture, transient search/IME Back handling and uncertain-action
guard are implementation work, not features this draft claims already completed.

## A. Completed

The toolbar reads **Completed**, with Back, Search and list filter access. Below
the compact scene show the current membership summary, **Include skipped
occurrences** switch, and **Most recently completed or skipped first** support.
Default excludes skipped. Global filtering offers All lists, No list and durable
named lists using icon-free choices under A27's provisional list-icon direction.
Fixed-list scope remains visible; omit an editable membership selector there.

Native title/notes search and membership filtering happen before cursor
pagination. Retain the current returned order; never re-sort by Event, title or
client-formatted date. No productivity chart, streak, bulk-complete or cleanup.

A row preserves the reminder title, category if available, original Event range,
list and meaningful repeat/exception metadata. Label **Completed** or **Skipped**
explicitly. Inactive alert information reads **Alarm was set for…** / **Notification
was set for…**, or **No alert**, with no future Scheduled promise. An expired
event does not turn completed work into an overdue warning.

**Collection timestamps:** use status-only collection rows in this R9 brief.
Native `collectionAtMs` is an ordering key that can fall back to Event time; the
query does not expose history/provenance. It must never become “Completed at,”
“Skipped at,” “Moved to Trash at,” or a date-group heading. Recorded dates remain
available in details/Activity when real history exists. Adding collection action
dates later would require a provenance-aware native projection and focused tests,
not a visual inference or a details request per row.

Completed rows have a labeled **Reopen** secondary action and More with **View
reminder** / **Move to Trash**. Reopen is distinct from editing, duplicating or
restoring and never replays an elapsed alert. Completed can move to Trash directly
through More or swipe reveal then deliberate tap, with revision-safe Undo.

**Skipped Reopen discrepancy:** current UI offers Reopen, but native Reopen clears
only `completed`, leaving `skipped` true. It cannot truthfully claim that a skipped
occurrence became unfinished. The R9-02 candidate shows Skipped and More (View /
Move to Trash), without an enabled Reopen for that row. Before implementing the
final skipped action, resolve the intended clear-skipped command contract and
tests with P07; do not ship misleading success or alter Restore's skip retention.
This is a documented unresolved behavior correction, not an approved new rule.

Truly empty: **No completed reminders.** With Include skipped on, **No completed
or skipped occurrences.** A filtered empty result says **No matches**, shows the
query/scope and provides **Clear search** or **Clear filters** only for editable
constraints. None of those clears fixed list membership or silently turns off
Include skipped. The return route still works; no creation CTA is necessary.

## B. Trash and recovery

Use the same collection anatomy with **Trash**, search and appropriate membership
constraint. Support reads **Most recently deleted first** and **Restore preserves
completion and never replays past alerts**. A concise explanation says **Items stay
here until restored.** Keep the local-retention and backup qualification available
in the scroll content: one-off Trash is excluded from backups; recurring deletion
exclusions are retained. There is no permanent delete, Empty Trash, automatic
expiry, retention countdown or bulk Restore.

Rows label **In Trash** plus meaningful previous work state: **Unfinished**,
**Completed** or **Skipped**. Retain original timing/category/list information;
show a labeled **Restore** action and More → **View reminder** / **Restore**.
No Done/Reopen action while deleted and no Trash swipe that suggests purging.
Deleted records do not advertise an active Scheduled alert. As in Completed,
list rows show no fabricated deletion timestamp.

| Restore result | Honest feedback and consequence |
|---|---|
| Previously Completed | **Restored to Completed.** Completion remains true; silent. |
| Previously Skipped | **Skipped occurrence restored.** Skip remains true; visible in Completed only with Include skipped on; silent. |
| Unfinished with elapsed Alarm target | **Reminder restored. No next alert scheduled.** Target is not replayed; returned state may be Missed. |
| Unfinished with future eligible Alarm target | **Reminder restored.** Show a next-alert/Scheduled statement only after actual native confirmation. Preserve a future Snooze/Postpone target. |
| No alert | **Reminder restored.** Remains No alert. |
| Blocked / Pending | Use the actual returned reason/pending wording; do not infer readiness from successful content restoration. |

Successful Restore removes the item from the current Trash query and retains
search/scope/remaining scroll position. Feedback stays on an inset-safe surface,
with clearance so it cannot cover rows/Load more or sit under the IME. Do not
auto-navigate to Agenda, reopen completed work or turn the entire collection empty
while refreshed data is pending. Refresh failure is separate from action success.

Reopen/Restore of a recurring occurrence makes it an independent exception under
the existing architecture. A restored unfinished future occurrence can become
eligible even if its family is paused; never promise “paused, no alert” solely from
the family. A focused paused-family Restore test remains necessary if that state
is implemented/captured. Past targets still do not replay.

An unfinished reminder moved to Trash from its details must confirm **Move
reminder to Trash?** (or **Move this occurrence to Trash?**) with **Its alert will
be cancelled. You can restore it from Trash.** Actions are **Keep reminder** and
**Move to Trash**. Completed/skipped work can move directly. Preserve the existing
native alert cancellation and captured-revision Undo; this is not a new purge flow.

Truly empty: **Trash is empty.** Keep the restoration/retention explanation and
Back. Filtered no-match uses the same scoped search recovery as Completed.

## C. Completed, Skipped and Trash details

Extend the accepted R4/R5 details template rather than create another layout.
Use Back + Reminder toolbar, full title/category identity, explicit work state,
Event range, consequential Due/alert summary, Notes, List/Repeat and conditional
Schedule details. Exact **Completed [date/time]** comes only from recorded Done;
missing history shows **Completed** alone. Skipped shows **Skipped**; Trash shows
**In Trash** and an explicit previous Completed/Skipped/Unfinished state. Recorded
Delete/Skip times, if displayed, also require their actual entries.

Inactive alert data stays historical; Postpone/Stop/Snooze are absent for these
terminal states. Completed details keeps a single persistent **Reopen reminder**
in the established outlined secondary style; Trash keeps a single persistent
**Restore reminder** in filled primary with paired on-primary content. Both use
the matching atmosphere roles and shared action geometry. Skipped Reopen remains the
unresolved correction above. No duplicate competing footer/menu primary or
color-dependent action availability. More retains supported Activity/Duplicate
and appropriate Trash actions; deleted records are not edited in place.

Terminal status does not erase the reminder's original Event/Due, Notes or repeat
identity. Reopen/Restore acts on the actual occurrence and preserves revision,
nominal identity and existing native alert reconciliation. A lost reply cannot
be treated as proof that the action failed or that a new operation is safe.

## D. Activity

Open through **Reminder details → More → Activity**, for one actual occurrence.
Back returns to those details, preserving their collection/list/root context.
Activity is read-only, with no root tab, Done/Restore footer, task creation or
app-wide family audit. The title and timeline remain scrollable.

Show the full reminder title and the existing scope qualification:
**Recorded actions for this occurrence. Changes to the whole repeat and individual
edited fields are not recorded here.** Time labels use the current device zone,
with a zone summary. Any displayed UTC offset is time-specific; do not imply a
single offset applies to history spanning daylight saving changes.

Group actual entries by displayed local date, newest first by `atMs`. Equal-time
entries retain native supplied order. Use locale-readable dates/year where needed.
A neutral timeline connector is decorative; entries are opaque readable surfaces
or grouped rows with labeled state/event icons, time and meaningful recorded target.
No entry looks tappable merely because it has a chevron/card.

Use existing event names, including **Completed**, **Reopened**, **Restored**,
**Moved to Trash**, **Occurrence skipped**, **Edited**, **Alarm stopped**, **Snoozed**,
**Postponed** and actual recorded terminal-session outcomes. Snooze/Postpone shows
**Alert moved to [date] · [time]** only with non-null stored `targetMs`, formatted in
the same device zone as its event time. It describes the target at that action,
not the reminder's current next alert or a rewrite of Event/Due. Suppress targets
for other kinds. Unknown kinds use **Other recorded action**, neutral history glyph
and actual time, without guessing a field difference or target.

The event-label map is not evidence that an event was emitted. Native Create,
ordinary Blocked/Missed registration, notification delivery and whole-family
changes do not currently journal all corresponding labels. StopAll records
per-occurrence Stop. Do not invent Created, Scheduled, Rang, Repeat paused/resumed
or every failed delivery from current state. Fixtures use actual recorded
Stop/Postpone/Edit/Done/Delete/UndoDelete kinds. Empty says **No recorded activity.**
Missing occurrence says **This reminder is unavailable.** Neither implies “nothing
ever changed” or a complete audit trail.

## E. Loading, filtering, errors and command recovery

Initial loading/error, truly empty, filtered no-match and retained refresh failure
are distinct. Preserve known collection rows/history on refresh or Load more
failure, with **Could not refresh. Showing previously loaded information.** and
labeled **Retry**. Initial failure has no stale-content assertion. Keep native
pagination, **Load more** / **Loading more…** and retry on page failure; never mark
the query complete or calculate a total from only the loaded page.

Search with IME uses one inset owner and a scroll viewport above the real Android
keyboard. No editor Save footer. Focus/caret and Clear search remain reachable;
Back dismisses IME before leaving. Feedback reserves space; suppress/crop the art
first instead of shrinking controls. Query and composing text survive appearance
updates. Actual IME/TalkBack/200% English/Chinese checks remain owed.

Capture operation ID, command kind, occurrence, expected revision and intended
success text before Reopen/Restore/Delete. While applying, prevent duplicate taps
and conflicting actions. When a reply is unconfirmed, keep the captured command,
show **Change not confirmed. Retry the same change before leaving.** and **Retry
change**; guard navigation and competing mutations. Retry reuses that exact command.
An explicit stale rejection is different: refresh and show the changed state, then
require a new deliberate action against its new revision. Do not automatically
overwrite newer content, assert failure from transport loss or generate a fresh
operation disguised as Retry.

Details already uses the captured-command pattern; collections currently do not.
The R9-12 uncertainty composition is a proposed application of established guards,
not an assertion that the current collection action path is safe. Revision-safe
Undo also checks the captured deletion against latest content. Stale Undo says
**Reminder changed; this deletion can no longer be undone** and preserves the
newer revision. Undo's transport retry retains its captured identity. Verify the
shared notice lifetime and all navigation paths; do not lose recovery on Back.

## Source gaps and implementation checks

| Area | Current baseline / required checkpoint |
|---|---|
| Routing | Global collections remain Browse roots. P05 converts them to secondary origins and preserves scoped keys/IME Back precedence. |
| Skipped Reopen | Native clears only completed. Resolve clearing skipped versus action availability; test before an enabled successful unskip is shown. Restore must still preserve skipped. |
| Unconfirmed collection actions | Collection handlers create a fresh operation per call. Implement the detail-style captured command/guard before Retry change. |
| Action dates | Collection query has ordering fallback without history. Keep this brief's status-only rows; any future recorded timestamp field needs provenance tests. |
| Paused repeat Restore | Existing exception behavior can re-arm a future occurrence independently. Add focused paused-family coverage; do not infer silence. |
| History coverage | Render recorded entries only. Journal expansion or complete-audit semantics is separate work. |

Inspect [records](../../src/app/records.tsx), [details](../../src/app/reminder/[id].tsx),
[Activity](../../src/app/activity.tsx), [rows](../../src/ui/reminder-row.tsx),
[presentation](../../src/domain/presentation.ts), [Undo guards](../../src/domain/actions.ts),
[navigation](../../src/ui/navigation.tsx), [native queries/actions](../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt)
and [native tests](../../modules/remilo-alarm/android/src/test/java/com/remilo/alarm/engine/AlarmEngineTest.kt).
These findings do not silently change a product contract or authorize production edits.

The [fixture brief](r9-completed-trash-activity-fixtures.json) specifies fourteen
readable captures: Completed, Include skipped, scoped no-match, mixed Trash,
completed Restore feedback, skipped Trash details, recorded Activity, retained
Activity failure, legacy completion without action date, empty Activity, search
with IME, unconfirmed Restore, stale Undo and unfinished Trash confirmation.
True empty collections, initial error, pagination, normal recorded completion
details, explicit stale rejection and paused/future/past/blocked Restore results
remain shared component verification cases; every permutation needs no new image.

For future generated references, place discrepancies beside each image and point
back here: soft matching surfaces, consistent neutral/action/status roles, compact
art, readable terminal text, correct Reopen/Restore and scope, no invented history/
dates/scheduling, and real keyboard clearance. Generated pixels are approximate;
actual RN layouts and measured contrast/targets/focus, large-text semantics,
native revision/receipt/alert tests and consolidated physical acceptance remain
separate. [Refinement evidence](../evidence/2026-10-07-r9-records-refinement.md)
records only checks actually performed for this draft.
