# Weekly routines — 15 October 2026

The owner-approved implementation plan extends reminders without a new root tab
or workout-specific appearance. This contract supplements the shared visual
language and current reminder editor; normal reminders retain their lifecycle.

## Setup and presentation

Use one reminder editor and one Save. Title → Type appears first; new drafts can
select Reminder or Weekly routine. Existing records and duplicate flows retain
their type. Switching a new draft preserves common title, time, Alert, List and
Notes, and caches each type's other fields. Direct new-routine entry defaults to
Notification; switching an unsaved ordinary draft preserves its selected Alert.
Keep the current compact header, keyboard-aware viewport and persistent Save.

Routine order is Title → Type → Starts on/time → Alert → Exercises by day → List
→ Notes and applicable sound controls. Show all seven connected weekday rows,
with full localized names, exercise counts, first two names and +N more. Rest
rows say Rest day · No alert. Remove the ambiguous Routine attachment tile and
Today only tile. One helper explains rest-day silence and independent dates.
Each weekday opens a scoped day draft with Workout day / Rest day, ordered
exercise rows and Add exercise. Done applies to the parent draft; Cancel/Back
protect unapplied changes. Only parent Save writes native state.
Rest day is explicit. Non-rest days require named exercises. Exercise identity
survives rename/reorder. Targets and notes are authored free text; do not infer
training weights or translate authored content. Removing an exercise has Undo.
A day has at most 100 exercises; a pending removal reserves space for its Undo
until Done finishes that scoped day edit.
Child changes stay in the parent draft until Save; cancel does not write native
state. Selecting Rest day retains its cached exercises in that unsaved parent
draft, so reopening the day and selecting Workout day restores them. Parent Save
sends an empty exercise definition for Rest day without mutating the cached draft.
Concurrent edits retain the draft and require review before replacing it.

Repeat days come from the plan. One shared time controls delivery. Plan, Alert,
time, sound, vibration and overall Notes edits apply tomorrow; show a concise
review with expandable changed-day/target details. Use the exact shared inline
Alert control and wording: Alarm / Notification / No alert. Alarm uses the normal
sound/vibration and access checks; it never silently becomes Notification. The
Notification option uses the dedicated quiet-by-default channel and shows its
actual Android settings. No alert hides the clock without losing draft minutes.

Agenda reuses the neutral event glyph and ordinary row geometry/More target.
Exercise counts are information, with no whole-routine checkbox or swipe Done.
Add a 4 dp progress bar and numeric count aligned with the row's metadata. Focus
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
The compact Completed & upcoming connected sequence omits the currently displayed
exercise and preserves original ordinals. Overall Notes is a separate disclosure
after that sequence. Final completion shows a compact summary and checked rows.
Skip today and Undo Skip today operate on the dated session.
Ended history can be corrected without reopening the day or delivery.

The library is within Lists. Preserve Agenda / Lists / Completed / Trash and
repeat-family navigation. Use shared connected-item seams/corners, opaque reading
surfaces, atmospheric browsing chrome, 16/14 sp text, scaling, 56 dp primary and
48 dp other targets. Both English and Simplified Chinese use the same anatomy.
Approved exercise illustrations are explicitly selected, immutable versioned IDs.
Do not infer equipment or bind artwork from exercise names. Unknown references
retain authored text and omit the image region. Center transparent contained
artwork in a soft 16:9 frame, width min(320 dp, available inner width), height at
most 180 dp, radius 16 dp. The whole frame opens the enlarged view; a visible
upper-right zoom glyph avoids covering the plank's foot contact. Give the frame
an accessible description.
At font scale 1.6+ or usable height below 640 dp use View illustration instead.
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
The widget consumes this same native session authority and adds the same compact
bar and completion/Undo vocabulary. The broader daily digest remains separate.
