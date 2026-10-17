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
unfinished exercise and its target, with a 4 dp segmented (up to 12 exercises) or
continuous bar alongside the numeric count. Resume opens that exact date and displayed exercise. A separate Done action
binds that exact exercise/date;
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

The owner's later 16 October widget correction uses the supplied clean reference
for hierarchy, with current shared colors, 16 dp primary corners and neutral
Classic mark. A new Routine Focus setup draft selects the first available routine
when none is selected, including when switching from Today. An explicit existing
selection, even unavailable, is never replaced. Today retains No routine.
Without usable content, setup renders a localized, clearly labelled **Example
preview · Sample content only** using the same production composition. Examples
never become saved content or action descriptors. Initial loading and failed
preview rendering have visible feedback and retry rather than a blank region.
The RemoteViews child fills an explicitly measured preview host in both axes.

The preferred footprint is 4×2. Actual available dp, not launcher cell labels,
selects 180×110 summary, 300×240 interactive and 300×440 expanded compositions.
Use a single opaque reading surface, system outer corners and 12 dp internal
padding. No nested routine card or weighted gap above a bottom action.

The compact hierarchy is Classic/Remilo plus weekday/date (14 sp), routine title
(22 sp), segmented progress and numeric count (14 sp), exercise (18 sp) and target
(14 sp). Resume is the sole filled 56 dp primary action to the exercise's right,
with current 16 dp button corners. The 48 dp footer contains one contextual item
(Next or Today’s accurate View Agenda count), neutral Refresh and a separate text
Done action. Eligible named Undo replaces the contextual item, including after
final completion. Expanded Routine mode adds upcoming exercises; expanded Today
adds the native reminder list. Compact Today keeps an accurate Agenda link/count.

Reserve footer height outside the list's remaining-height region. Center
intrinsic-height labels in the measured action boxes; never stretch a footer
TextView to fill a parent. Refresh keeps a 20 dp glyph inside its growing touch
target at enlarged text sizes. Compact Today without a routine shows one complete
reminder row; expanded Today retains the scrollable native results. Do not show
partially obscured rows behind View Agenda. Use 12 dp after the title and 16 dp
after progress before the exercise/action row. Rest days show Rest day once,
No exercises scheduled today and a neutral View routine action, without Resume
or Done. Completed/skipped/ended sessions similarly show their native outcome.
Real empty Today widgets show No reminders for today, a short explanation and
View Agenda; no example reminders appear on the home screen.

Summary sizes and font scale 1.6+ open the exact dated session instead of squeezing
controls. At 1.2–1.6, interactive Focus requires expanded height and omits secondary
lists. Intermediate text scales also require at least 24 + 210 × fontScale dp
height for interactive content. Use exact available widget dimensions rather than
assuming launcher cells provide a particular height. Scale actions/text, keep 56/48 dp targets, and prioritize identity/outcome
in very small summaries. No text shrinking. EN/ZH use the same anatomy.

Reconfiguration uses the launcher's Edit/Configure affordance; remove the Settings
gear from routine content. Setup and picker previews render this actual Glance
composition with inert actions. Missing/trashed selections stay explicit and
never switch to another plan. No exercise art or new scenery in the widget.

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
  The current quality guidance explicitly requires intentional zero/empty states,
  accurate previews, no cropped content and at least 48 dp targets. These directly
  inform the owner's blank-preview and clipping correction.
- [Apple widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets?changes=la&language=objc):
  concise content, simple relevant interactions and contextual deep links; avoid
  both unnecessary density and sparse layouts that communicate no value.
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
