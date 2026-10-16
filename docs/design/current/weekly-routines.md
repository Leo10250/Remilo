# Weekly routines — 15 October 2026

The owner-approved implementation plan extends reminders without a new root tab
or workout-specific appearance. This contract supplements the shared visual
language and current reminder editor; normal reminders retain their lifecycle.

## Setup and presentation

Keep Title → Date/Time → Alert → Repeat → Routine → List → collapsed optional
information, the compact editor header and the persistent Save footer above IME.
Routine opens a weekly draft sheet; each weekday opens its exercise editor.
Rest day is explicit. Non-rest days require named exercises. Exercise identity
survives rename/reorder. Targets and notes are authored free text; do not infer
training weights or translate authored content. Removing an exercise has Undo.
Child changes stay in the parent draft until Save; cancel does not write native
state. Concurrent edits retain the draft and require review before replacing it.

Repeat days come from the plan. One shared time controls prompts, while Today
only explains all-day availability and midnight closure. Plan/time edits apply
tomorrow, with a review of changed days/targets. Notification and No alert are
the only routine alert modes. Show actual Android channel access/settings.

Agenda reuses the neutral event glyph and ordinary row geometry/More target.
Exercise counts are information, with no whole-routine checkbox or swipe Done.
Focus shows one name, target and optional short guidance, with Mark as done.
The connected sequence keeps completed/upcoming exercises accessible. Previous/
Next only changes the view. Undo completion is explicit and persists after the
final exercise. Skip today and Undo Skip today operate on the dated session.
Ended history can be corrected without reopening the day or delivery.

The library is within Lists. Preserve Agenda / Lists / Completed / Trash and
repeat-family navigation. Use shared connected-item seams/corners, opaque reading
surfaces, atmospheric browsing chrome, 16/14 sp text, scaling, 56 dp primary and
48 dp other targets. Both English and Simplified Chinese use the same anatomy.
Approved exercise illustrations are optional; v1 has no approved exercise asset,
so the actual components use the exercise text and authored guidance.

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
- [Android notification design](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications)
  informs one concise, relevant prompt and removal of stale delivery. Notification
  body taps open the dated session; no redundant Open button, Done or Snooze.
- [Apple notifications](https://developer.apple.com/design/human-interface-guidelines/notifications),
  [feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
  and [Undo](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo)
  inform privacy, proportional feedback and visible reversal. Android conventions
  remain authoritative; this introduces no iOS implementation.

Actual component/host checks and signed-phone usability acceptance remain distinct.
The widget and broader daily digest consume the same native session authority in
later milestones; they add no competing progress store or scheduler.
