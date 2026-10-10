# UX refinement — owner-approved 10 October 2026

The owner explicitly approved implementation of the six-package UX refinement
plan in this chat on `UX-Improvement`. This correction supersedes earlier page
structure, copy, focus and filter requirements where they differ. Preserve all
eight R3 styles, existing artwork, geometry, four roots and native authority.
Frozen submissions and earlier evidence retain their historical scope.

## Editor and keyboard

Fresh blank creation requests Title focus once. Edit and duplicate start closed.
Successful Save and confirmed discard blur the editor's own inputs and dismiss
the keyboard before destination navigation. Keep validation, dirty/stale drafts,
pending-save and unknown-reply guards; Back closes IME before leaving. One Save
remains above IME and submits on its first tap. Shared viewport unmount does not
dismiss another screen's keyboard.

Title retains 200 characters, grows from 48 dp to three measured visual lines
at the current text scale, then scrolls internally. Done ends editing without
saving or inserting a newline. Notes keeps separate sizing. Restored search keeps
query and presentation without autofocus; only an explicit Search action requests
focus, consumed once and never stored in destination state.

Main order: Title; Event time Date/Time; Alarm/Notification/No alert; exactly one
preview-backed Alarm time or Notification time; Repeat; List; Notes; Schedule
options; Alarm options when applicable. Alert editing makes timing independent.
Support reads At event start, Follows due time, 9 AM on this date or Custom time.
Schedule options retains linkage, not a second alert picker. Remove the repeated
full Schedule preview. Keep validation, conversion warnings and repeat next dates.
Preview identity includes schedule/repeat only and uses a non-private placeholder
title. Save validates the real Title. Updating/failure never presents an older
schedule as the resolved current preview.

All day uses an editor-only timed snapshot of civil clock, elapsed duration and
linked civil offsets. Timed → All day resolves local selected midnight/next
midnight; linked Due uses date end, linked alert uses 9 AM, and independent values
retain exact instants. Link flags survive. All day → Timed restores remembered
clock/duration/offsets on the currently selected date/current zone. An initially
all-day draft uses 9 AM/30 minutes; normal past validation applies. Explicit zone
changes retain existing clock-preserving conversion. Explicit relinking resets
that remembered offset to zero. Adopting latest timing/reloading clears the
snapshot; Keeping Yours retains it. Serialized native civil conversion completes
before committing a transition; failure keeps the previous draft. The snapshot
never enters commands, backups or storage.

## Details and cards

Details leads with Title and a prominent combined mode/time row, then state,
conditional Event, independent/non-default Due, Repeat, List, Notes, Schedule
details and persistent actions. Use Alarm, Next alarm, Intended alarm or Original
alarm according to native state; Notification follows the same rules. No alert
leads with Scheduled for and its event date/range. Remove ordinary Alert mode and
Next alert rows and routine Due at event start support.

Alert-enabled Event is in the main group for all-day, differing event/eligible
alert instants or existing publication context. Without a current target, compare
the original authored alert. Independent coincident Due stays visible. Schedule
details retains hidden full ranges, linkage, zones, original adjusted alert and
occurrence exceptions. Existing publication queries and behavior stay intact.

Card timing selects meaning before formatting: Scheduled uses current operational
target; adjusted Scheduled uses Next alarm/notification plus adjustment; Pending,
Updating and Blocked use Intended with explicit unconfirmed state; elapsed/failed
delivery uses Alarm/Notification time; terminal records use Original authored
alert; No alert uses Event. Ringing leads state. A populated nextAlertMs alone
never proves a future scheduled delivery. Original native overdue reference and
recorded Done completion dates remain authoritative.

Omit a visible date only beneath a real matching civil-date header. Retain dates
in Overdue/Earlier, history, ungrouped, mismatched-zone and cross-day contexts.
Spoken summaries include complete absolute dates and state. Preserve accessible
row Open, independent More and long press; remove View reminder. Agenda menu:
Edit/Postpone/Done/Move to Trash; Completed: Reopen/Move to Trash; Trash:
Restore/Delete permanently, with existing eligibility/confirmation/Undo/retries.
Remove Open list where tapping the list row already opens it.

## Filters and collections

One applied object per destination is retained. Filters opens a temporary copy;
Apply filters commits atomically, Cancel/close/backdrop/Back discards it. Unchanged
Apply preserves query, pagination and exact scroll. All/Today/Upcoming and search
remain independent. Filters · N counts editable optional filters only. Removable
List/Overdue/Alert problems/Skipped included chips show applied state; fixed list
scope is visible and non-removable. Status precedes List in the sheet.

Reset filters restores every optional value, including Show skipped. Sheet Reset
affects the draft until Apply; outside Reset commits. Individual chip/search
removal never resets skipped. Reset retains search, time view and fixed scope.
Changed criteria cap deep scroll at the pinned header boundary and synchronize
actual/retained scroll and chrome without remounting. Selection/pending/unknown
operations disable changes and every handler rechecks synchronous guards.

Completed defaults to completed-only; Show skipped lives in Filters and enabled
state shows Skipped included. Rows retain Skipped labels. Trash has one quiet
sentence: Kept until restored or permanently deleted. Backup exclusions belong
to backup information; Restore feedback and permanent confirmation remain.
There is no automatic expiry. Empty states distinguish genuine destination/time
emptiness from No reminders match these filters. Clear search and Reset filters
are separate actions when both apply.

## Settings, permissions and shortcuts

Settings retains its atmospheric opening. Order: conditional actionable warning;
Sound & vibration (For new reminders); Snooze & postpone; Appearance;
Permissions & alarm check; existing Google Calendar; Backups; Help.
`/alarm-check` uses compact chrome and owns the whole permission/Test workflow,
including state, guards, feedback and same-operation retry. Preserve invoking
origin and Settings scroll. Direct settings actions have concise nearby
explanations and Back is the opt-out; add no rationale dialog. Recheck on return.

Separate Alarm blockers (exact access/app notifications/Alarm channel),
Notification blockers (app notifications/Reminder channel), full-screen display
limitation, checking/error/stale observations. Say Permissions allowed, never
Alarms working. Channel details disclose on demand and expand for a problem.
Test alarm remains In 15 seconds with truthful Scheduled/Blocked/Pending/Rejected
and unknown outcomes. Unknown freezes navigation and retries the same test.

The lifetime preference controller automatically saves captured operations across
sheet closure/page changes. One failed-job recovery stays beside its owning
Settings group; Appearance has one recovery for its two preferences. Tomorrow
shortcuts show three stable clock rows and a compact 10 AM · 2 PM · 5 PM summary.
Picker confirmation saves, Cancel preserves old value. Store minutes-of-day with
a DST/zone-safe picker carrier. Postpone uses Tomorrow, 10 AM, relative shortcuts,
custom date/time, exact target preview, one confirm and one concise scope sentence.

Appearance has independent Color mode (Match device/Light/Dark) and Atmosphere
(By time of day/Sunrise/Sky/Evening/Night). Stored values are unchanged. The choice
sheet adds decorative 32 × 24 dp canonical surface/accent swatches with outline,
full labels and separate selection indicators; automatic has a neutral clock.
Automatic shows Now from the existing shared displayed-scene resolver and a
collapsed Daily schedule: 06–10/10–17/17–21/21–06 in localized clock formatting.
Support is Uses your device's local time. Add no assets/tokens/timer. Condense
repetitive appearance/backup text and replace repeat engine terminology while
retaining consequential pause/exception and recovery rules.

## Scope and verification

Frontend-only interfaces cover filters, timed snapshot, card context, semantic
timing, owned field refs and permission observation. Native APIs/schema/commands,
backup versions, scheduling and overdue policy stay unchanged. Calendar repair,
new art, native alarm redesign, installation and distribution are excluded.

UX-13–18 in [backlog](../../backlog.md) own package status. Run meaningful timing,
preview, presentation, filter, settings and clock tests; verify shared/design then
Android sequentially. Review actual components in eight pairs, 360 dp, landscape,
200% English/Chinese and reduced motion. [Consolidated owner acceptance](../../device-acceptance.md)
keeps actual IME, TalkBack, permission handoff and audible delivery pending until
observed on an identified signed build; browser/host evidence cannot pass them.
