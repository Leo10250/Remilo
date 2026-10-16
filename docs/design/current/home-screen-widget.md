# Android home-screen widget — 15 October 2026

The owner-approved RW-03 contract adds one configurable Android widget. It uses
the current visual language and the native routine authority, with no new root,
workout scenery, wallpaper automation, lock-screen implementation or iOS work.

## Configuration and content

Settings opens native setup in Today mode. A routine's contextual Add to Home
screen opens Routine Focus with that routine. Each placed instance independently
selects Today or Routine Focus and an optional/required routine, respectively.
Today includes all lists' unfinished reminders whose Agenda time falls today or
whose original alert is overdue. Local Calendar imports participate as ordinary
reminders; the widget never fetches Calendar content. Show at most 20 reminder
rows with the accurate total and View Agenda. Rows open existing Details.

Focus shows the selected routine, explicit date, numerical daily progress, first
unfinished exercise and its target. Mark as done binds that exact exercise/date;
advance only after native acknowledgement. Show the most recent widget-completed
exercise's name beside an explicitly labelled Undo, including after the final
exercise. The app retains all other corrections and Skip/Pause/history actions.
Rest, Skipped, Completed and Paused follow native session eligibility. Removing a
selected routine never selects another routine automatically.

## Appearance and sizing

Use existing atmosphere/brightness roles, neutral Material glyphs and Classic
identity. The outer shell uses Android's system widget corner radius. Connected
items retain 2 dp seams and 16/4 dp corners, with opaque themed surfaces. Native
setup uses compact chrome, one persistent Save and a production-composition preview
with inert controls. Cancellation never commits configuration or exercise checks.

The default footprint is 4×4, with responsive 180×110, 300×280 and 300×440 dp
compositions. The compact summary opens Remilo; interactive sizes provide Refresh,
Settings and guarded exercise actions. At font scale 1.6 and above, use summary
content rather than shrink text or touch targets. Primary targets remain at least
56 dp and other controls at least 48 dp. English and Simplified Chinese share the
same structure; authored exercises, targets and reminder names remain unchanged.
Compact summaries retain the selected routine's visible name, date and progress
or outcome so independent routine widgets remain distinguishable.

## Freshness and privacy

Refresh after native changes and user actions, on resize/reconfiguration and
recovery/unlock/language/clock changes, with coalesced background work, a requested
next civil/atmosphere boundary and a 30-minute recovery opportunity. Android may
defer background work. Explicit dates and native stale-action rejection remain
required even while the launcher retains cached pixels. Compact views open the
app for refresh/actions. No exact-midnight display guarantee is made.

Use generic content before first unlock and on unsupported hosts. Declare
home-screen and `not_keyguard` placement. Widget configuration/action identities
are CE-only, contain no copied progress and are excluded from portable backup.
First placement uses a nonpersonal localized Loading placeholder; the direct-boot
receiver replaces it with the generic Unlock message while the user is locked.

## Evidence informing the design

- [Google widget design](https://developer.android.com/design/ui/mobile/guides/widgets)
  and [quality criteria](https://developer.android.com/docs/quality-guidelines/widget-quality):
  focused use cases, adaptive sizing, accurate previews, readable controls and
  updates after app/widget actions. Android conventions govern implementation.
- [Apple widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets?changes=la&language=objc):
  concise content, simple relevant interactions and contextual deep links.
- [While et al., CHI 2024](https://arxiv.org/abs/2403.12343): age-related differences
  in glanceable smartwatch-chart perception motivate explicit text/counts and
  readability testing; this is not a comparison of these widget layouts.
- [Hollman et al., 2025](https://formative.jmir.org/2025/1/e59477/): reported text
  burden, lost progress and correction problems support concise content, durable
  native progress and explicit Undo; the small usability study does not establish
  adherence outcomes for Remilo.
- [Yerrakalva et al., 2025](https://www.nature.com/articles/s41746-025-01785-x):
  widget use was associated with a smaller subsequent decline in brisk walking
  in Active 10. The observational analysis does not establish widget causality.

These sources inform the choices; they do not prove Focus outperforms checklists.
Host renders, launcher behavior and signed-phone acceptance remain distinct.
