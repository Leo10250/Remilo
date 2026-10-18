# Weekly routines — 15 October 2026

The [18 October generic-routine correction](routine-creation.md) supersedes unified
creation/type switching, seven-day-first authoring and workout-only setup below.
Native dated-session, delivery, history, photo and action rules remain authoritative.

The owner-approved implementation plan extends reminders without a new root tab
or workout-specific appearance. This contract supplements the shared visual
language and current reminder editor; normal reminders retain their lifecycle.

## Setup and presentation

Create offers separate reminder/routine destinations, with no type selector in
either editor. /routine-edit owns routine create/edit/duplicate drafts and uses
the compact header, keyboard-aware viewport and persistent Save. The library's
New routine enters directly. Blank drafts default to General/Shared, no selected
weekdays and Notification; there is no seeded content.

Routine order is Title → Preset → Steps → Schedule → Alert → List → Notes and
applicable sound controls. General uses one shared sequence by default. The Days
picker is the only scheduling control. Different steps by day switches the whole
routine to independent selected-weekday rows with counts and name previews.
Nested day drafts have no Workout/Rest selector. Done updates the parent draft;
only parent Save writes native state. Direct row editing has its own persistent
Save. At least one selected day and named steps on every selected day are required.
Step IDs survive rename/reorder; Shared mode additionally retains logical shared
keys. Prescriptions and instructions stay free text. Removing a step has Undo.
A day has at most 100 steps; pending removal reserves room for its Undo until
Done finishes the scoped edit. Unselecting/reselecting a day caches its content
and IDs until the parent editor closes; Save sends empty Rest data for unselected
days. Returning to Shared requires an explicit source/replacement review.
Concurrent edits retain the draft and require explicit reload before replacing it.

Repeat days come from the plan. One shared time controls delivery. Plan, Alert,
time, sound, vibration and overall Notes edits apply immediately on Save; show a concise
review with expandable changed-day/target details. The 17 October owner correction
supersedes tomorrow-effective edits: reconcile today's open session to the new
definition, retaining its occurrence and matching stable-ID checkmarks. Added
scheduled weekdays are available today; unscheduling today cancels its delivery and
removes actionable Agenda work. Completed/Skipped aggregates follow the revised
exercises while an intentional skip stays skipped. Closed days retain their exact
snapshots, and elapsed or already-posted prompts never replay. Use the exact shared inline
Alert control and wording: Alarm / Notification / No alert. Alarm uses the normal
sound/vibration and access checks; it never silently becomes Notification. The
Notification option uses the dedicated quiet-by-default channel and shows its
actual Android settings. No alert hides the clock without losing draft minutes.

Agenda reuses the neutral event glyph and ordinary row geometry/More target.
The owner's 16 October tile correction uses the supplied compact mockup for
alignment/hierarchy and the current ordinary tile for style. Active routine rows
place a 24 dp informational progress ring in the same 48 dp leading column as an
ordinary reminder's completion control. The neutral 20 dp event glyph, 6 dp text
gap, title, timing/repeat metadata and fixed 48 dp More target share the ordinary
row's horizontal anchors and first-title-line optical center. The ring is inside
the row's open-details target, with no separate completion action. Selection uses
the existing selection checkbox instead; terminal rows reserve no leading slot.

Exercise counts are information, with no whole-routine checkbox or swipe Done.
After timing and applicable repeat/status metadata, leave 12 dp before the
progress footer, aligned to the title text. At ordinary size/available width use
a 48 dp long, 4 dp thick segmented bar, an 8 dp gap and the existing numeric count
in 14 sp supporting text. A narrow column, long count or increased text scale
uses count above a full-column bar with an 8 dp gap. Never shrink text or controls.
Keep current surface, accent/soft/outline roles, 16 dp corners, 12 dp card padding
and ordinary inter-card spacing; mockup colors or geometry do not replace them.
Focus
uses the current Page header, localized weekday title and the existing weekly
title at 24 sp inside the content, explicit date and frozen Alert metadata.
The count/state precede a 6 dp progress bar: up to twelve equal segments with 2 dp
gaps, otherwise continuous fill. Numeric/spoken progress always accompanies it.

Use the owner's preferred standalone Focus card: 16 dp radius/padding, 12 dp
internal gaps, 14 sp ordinal, 24 sp exercise name, optional illustration, intact
authored 24 sp target, 16 sp guidance (three lines plus Read more sheet) and a
full-width 56 dp Complete & continue action. With one unfinished exercise, label
it Complete exercise. View previous exercise changes selection only. Advance
after native confirmation, keeping the card anchor and accessibility focus;
show named completion feedback and Undo above the card, including after the last
exercise. Completed exercise views have an explicit Undo completion action.
The connected Exercises sequence includes every exercise, including the displayed
one, and preserves original ordinals and stable keys. Selected rows use the soft
surface, accent ordinal/check badge, visible Viewing text and accessible selected
state; completed rows retain Done. Selection changes the card, never checks, and
has no navigation chevron. Completion advances to the first unfinished exercise
after native acknowledgement. Overall Notes is a separate disclosure
after that sequence. Final completion shows a compact summary and checked rows.
Skip today and Undo Skip today operate on the dated session.
Ended history can be corrected without reopening the day or delivery.

The library is within Lists. Preserve Agenda / Lists / Completed / Trash and
repeat-family navigation. Use shared connected-item seams/corners, opaque reading
surfaces, atmospheric browsing chrome, 16/14 sp text, scaling, 56 dp primary and
48 dp other targets. Both English and Simplified Chinese use the same anatomy.
New routine Starts on/time reuses the ordinary editor's responsive two-column
date/time anatomy and independent pickers. Required labels use one localized
Title (required) label. General fields are Step name, Amount or duration,
Instructions and Step image. Exercise fields retain Exercise name, Sets, reps or
time, How to do it and Exercise image. Both use empty-field examples and help.
Weekly/day draft edits still require the one parent Save. The direct row editor
below is a separate single-exercise Save using the same revision-guarded command.

### Direct exercise editing — 17 October 2026 correction

Today's and future unended session rows expose pencil + Edit beside the body.
Each connected row is a noninteractive surface containing two sibling controls:
badge/name/prescription/status selects the Focus card; the neutral trailing Edit
opens that exact stable exercise ID directly. Neither Edit nor its return selects
or scrolls to Focus or changes checks. Preserve 16/4 dp corners, 2 dp seams,
14 dp padding, minimum 64 dp row height, selected soft surface, Viewing and Done
labels. Controls have separate pressed/focus states and at least 48 dp targets;
rows grow with text. No chevron or filled treatment for Edit. Its accessible name
includes ordinal, exercise name and weekday; closing returns focus to that Edit
when its row still exists. Past/ended/deleted rows have no direct Edit; historical
checkmark correction and weekly-editor access remain separate.

Use the same preset-aware step form and full-frame photo chooser in builder and
direct editing. Shared context says All scheduled days · Routine and explains
linked edits; independent context names the weekday. Both explain immediate
application, matching checks and frozen past days.
Prefill from the latest weekly definition by captured routine/date/weekday/ID,
never by name or ordinal. One persistent Save clones that captured plan and
replaces the matching step (and its linked copies in Shared mode); unrelated
content, IDs and order stay intact. Add/remove/reorder stay in the builder. Save uses one
stable EditRoutine operation with the loaded plan revision. Uncertain results
reuse the captured command; conflicts retain the draft and offer Reload exercise
with dirty-discard confirmation. A missing/trashed exercise reports an actionable
error. Keep image draft leases through uncertain recovery, releasing them on
cancel/confirmation. Native immediate editing owns concurrency and midnight;
ended snapshots never change. Refresh session/widget queries after confirmation
without resetting the selected ID or underlying scroll.

Approved exercise illustrations are explicitly selected, immutable versioned IDs.
Do not infer equipment or bind artwork from exercise names. Unknown references
retain authored text and omit the image region. Center transparent contained
artwork in a soft 16:9 frame, width min(320 dp, available inner width), height at
most 180 dp, radius 16 dp. The whole frame opens the enlarged view; a visible
upper-right zoom glyph avoids covering the plank's foot contact. Give the frame
an accessible description.
At font scale 1.6+ or usable height below 640 dp use View illustration instead.
Custom photos use the same contained/enlarge treatment and View image fallback.
The chooser starts with Add your photo/Replace photo, previews the full frame,
offers Use photo/Choose another photo, then the illustrated library and Remove
image. One still photo per exercise; no crop, camera, animation or URL editor.
Photos stay private/offline and enter immediately effective immutable revisions;
closed historical sessions retain their previous photo references.

Routine More opens a shared contextual sheet over its originating Agenda,
library, editor or Focus screen. Only an explicitly chosen destination navigates.
History is a visible row after the exercise content in Focus, outside More.
Move to Trash affects the whole weekly family and recorded days, has named Undo,
and is last/destructive. Trash shows one family with its weekly definition;
Restore preserves child states and prior Active/Paused state. Purge requires the
existing permanent-deletion confirmation. Neither Restore nor backup replays
elapsed prompts or reopens closed history.
The separate [exercise asset profile](../production-assets/exercises/profile-v2.json)
does not inherit historical scenic reference pixels. Each asset requires its own
artwork and activation approval before entering the static Metro asset map.
The owner's 16 October standing approval covers the existing and upcoming artwork
for this correction task; it removes further individual approval questions while
retaining candidate-bound provenance and technical/visual review.

## Native routine Alarm presentation

Routine Alarm uses the same global atmosphere, surface roles and native action
sizes as ordinary alarms. Actions are Start routine / Snooze / Dismiss alarm.
Start first confirms dismissal of this alert, then opens the exact dated session
after unlock. Dismiss changes no exercise checks. Snooze preserves progress and
can only target a future time within this date. Mixed ringing groups expose
per-member actions; routine members cannot use generic Done/Done all. Ordinary
alarm actions retain their existing completion behavior. Timeout/interruption
leaves exercise progress intact. Midnight, final exercise, Skip, Pause or deletion
detaches only this routine member from sound; unrelated alarms continue.

## Evidence informing the choices

The research supports simple navigation, understandable demonstrations, low-effort
tracking and correction. It does not establish that cards outperform checklists,
or that midnight expiry improves adherence; those reflect the owner's workflow.

- [Berry et al., 2026](https://aging.jmir.org/2026/1/e87332/): 18 older adult
  co-design participants emphasized readability, simple navigation, customizable
  reminders and clear exercise demonstrations; limited generalizability.
- [Hollman et al., 2025](https://formative.jmir.org/2025/1/e59477/): iterative
  workshops and a two-week pilot with 14 inactive adults identified text-heavy
  cards, lost progress and confusing correction/completion controls as problems.
- [Goevaerts et al., 2025](https://formative.jmir.org/2025/1/e76978/): year-long
  experiences from 100 cardiac patients highlighted reporting burden, repetitive
  prompts and technical frustration. Clinical results do not predict Remilo use.
- [Gibson et al., 2024](https://humanfactors.jmir.org/2024/1/e63707): iterative
  co-design/usability work supports evaluating concrete tasks and refining observed
  problems, not claiming a predicted usability score for Remilo.
- [Material 3 lists](https://m3.material.io/components/lists/overview) informs
  scan order and consistent text/actions. Remilo's approved geometry governs.
- [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
  informs 48 dp targets, understandable labels and text scaling. Prominent Remilo
  actions retain the existing larger targets.
- [Apple's WWDC25 writing guidance](https://developer.apple.com/videos/play/wwdc2025/404/)
  informs the shared vocabulary and removal of redundant or ambiguous labels.
  [Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls)
  informs visible essential controls and clearly named optional details.
- [Android notification design](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications)
  informs one concise, relevant prompt and removal of stale delivery. Notification
  body taps open the dated session; no redundant Open button, Done or Snooze.
- [Apple notifications](https://developer.apple.com/design/human-interface-guidelines/notifications),
  [feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
  and [Undo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo)
  inform privacy, proportional feedback and visible reversal. Android conventions
  remain authoritative; this introduces no iOS implementation.

Actual component/host checks and signed-phone usability acceptance remain distinct.
The widget consumes this same native session authority and shows its compact bar
with direct Done, adjacent unfilled Undo and exact-exercise text navigation.
Uncertain actions retain exact Retry. The broader daily digest remains separate.
