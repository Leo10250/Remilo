# Settings, Appearance, permissions and Test alarm

Revision 2 · 7 October 2026 · **R8 design direction/templates accepted; associated pixels approximate.**

Consolidated 8 October 2026 under A36. Use [the current index](../README.md).

[A28 intake](../../r8-settings-appearance-intake.json) records the owner's continuation
request and explicit requirement to use every R3 image for style while preserving
established UX. This review batch follows the accepted R7 outline; it is not a
new implementation milestone. [Fixtures](../../r8-settings-appearance-fixtures.json)
define thirteen readable states. [A29](../../r8-settings-appearance-image-intake.json)
authorizes their generation; [A30](../../approved-ui-r8-outline-acceptance.json) records
the owner's “Approved” response during that work. It accepts the R8 direction and
templates shown so far. [The thirteen-screen gallery](../../remilo-r8-settings-appearance/gallery.html)
preserves associated references and per-image corrections. R8-08 was completed
after that response as a supplementary state under the accepted direction; no
separate owner review or immutable-pixel acceptance of every raster is asserted.

## Authority and boundaries

Use [the shared visual language](../visual-language.md), [appearance policy](../appearance-policy.md),
all eight R3 references and established native/product UX. TD-02 owns saved global
appearance, resolution and the safe native mirror; TD-03 owns Settings presentation.
Production currently stores brightness only. A36 adds the five-value atmosphere
selection and Automatic defaults; no production storage change is performed by this
document. Preserve serialized preference saving, inline permissions, native sound
preview, Snooze/tomorrow shortcuts and guarded Test behavior.

## All eight visual references

Every R8 component/state supports all four atmospheres in both appearances.
Different candidates exercise different pairs, rather than require every possible
state/theme permutation. Brightness is independent of scene identity.

| Atmosphere | Light reference and shared roles | Dark reference and shared roles |
|---|---|---|
| Sunrise | [01](../../remilo-r3-atmospheres/01-sunrise-light.png): peach/gold sunrise, mountain lake/conifers; warm off-white canvas, white raised surfaces, burnt-orange primary/light content. | [02](../../remilo-r3-atmospheres/02-sunrise-dark.png): same sunrise identity; soft charcoal canvas/raised charcoal, pale-apricot primary/dark content. |
| Sky | [03](../../remilo-r3-atmospheres/03-sky-light.png): clear blue clouds, lake and green banks; pale cool-blue canvas/white surfaces, saturated-blue primary/light content. | [04](../../remilo-r3-atmospheres/04-sky-dark.png): same daytime scene, darker quiet sky; blue-slate canvas/raised slate, pale-sky-blue primary/dark content. |
| Evening | [05](../../remilo-r3-atmospheres/05-evening-light.png): coral/rose sunset, sun/reflection and purple mountains; pale rose/off-white canvas/white surfaces, muted-plum primary/light content. | [06](../../remilo-r3-atmospheres/06-evening-dark.png): same sunset identity; plum-charcoal canvas/raised plum, pale-rose primary/dark content. |
| Night | [07](../../remilo-r3-atmospheres/07-night-light.png): crescent/stars, moonlit blue lake; icy-blue canvas/white surfaces, deep-blue primary/light content. | [08](../../remilo-r3-atmospheres/08-night-dark.png): same moonlit identity; navy-slate canvas/raised navy, pale-periwinkle primary/dark content. |

Use matching shared canvas **and** elevated-surface roles under A24. No independent
Settings black, sampled PNG hex, glass reading card, or new scenic interpretation.
Sky Dark retains daytime clouds; Night Light retains moon/stars above a Light
reading plane. Reuse one selected scene asset/crop policy across pages. The owner's
[production-art abstraction review](../../production-assets/style-decision.md) is now active,
with final assets requiring individual approval. Settings glyphs, chevrons, ordinary values and helper text
are neutral. Primary identifies actual actions, focus and selected controls;
status colors require labeled meaning and remain independent of atmosphere.

## Shared layout and navigation

- Review at 360 × 800 dp with actual system insets and one screenshot per image.
  Use a compact secondary opening, approximately 96 dp below the status inset
  including a 56 dp toolbar. Back + Settings/Appearance supplies the heading;
  no oversized repeated Remilo branding or motivational copy. Crop/scroll art
  first when height, large text, a modal or keyboard constrains useful content.
- Settings is secondary and returns to its invoking origin. Appearance returns
  to Settings with its scroll position retained. Neither page shows the root
  Agenda / Lists / Repeats bar or Add FAB. Permission/Test states are portions of
  Settings, not invented Readiness or Test-alarm destinations.
- Keep 16 dp gutters/corners, opaque grouped reading cards, 16 sp values and
  14 sp support. Minimum row targets are 48 dp; prominent actions are at least
  56 dp. Rows wrap/grow. Use sections and scrolling rather than squeeze all
  six Settings categories into one viewport. Sheets share the same surface roles.
- Disclosure rows navigate/open a picker; switches toggle a boolean; radio
  choices select one value. Status pills and decorative previews are not switches.
  Whole-row and adjacent Play/Stop targets remain separate and non-overlapping.
- Shared loading, retained refresh failure, saving, validation, disabled and
  uncertain-operation states retain honest text and accessible announcements.
  Ordinary Settings navigation does not cancel its lifetime preference controller.

## A. Categorized Settings and preference saving

Retain category order **Alarms → Permissions → Postpone shortcuts → Appearance
→ Data → Help**. Alarms contains Sound, Vibration, Snooze duration and Test alarm.
Permissions is directly usable inline. Appearance has one disclosure row with a
concise global-atmosphere/brightness summary. Data retains Export/Restore;
Help retains Diagnostics and factual build/version information. Backup/diagnostics
workflows get a later review. No accounts, weather, content classifier, launcher
automation, custom list-icon picker or other product destination is added here
beyond the expressly proposed Appearance page.

**Different preference scopes must be visible:**

| Preference | Meaning / helper |
|---|---|
| Sound and Vibration | Defaults for new reminders. Existing reminder choices are preserved. |
| Snooze duration | Used the next time Snooze is invoked, including existing alerts. Changing it does not move a current target or reset a ringing session's deadline. |
| Tomorrow shortcuts | Local clock-time choices used for later Postpone selections. Editing a shortcut does not move already postponed reminders. |
| Brightness / global atmosphere | Presentation only; no event/due/alert or completion effect. Four-atmosphere persistence is TD-02 work. |

Valid preference changes save automatically through the existing serialized
controller. There is **no page-level Save/Apply footer**. Present optimistic
selection with “Saving changes…” until acknowledgement **and** the refreshed
revision are known. On failure show the last confirmed values plus contextual
error/“Retry saving changes”; do not assert that a lost acknowledgement means
the native write did not happen. Uncertain-job Retry keeps its captured operation/
revision. Later choices coalesce to the latest value per field and apply after
acknowledgement and revision refresh. A confirmed stale rejection reloads/rebases
under a new operation using the existing controller contract, rather than
overwrites another confirmed change.

Keep error/progress near the affected section and discoverable on return; it
must not float over rows or disappear solely because a transient sheet closes.
This is a proposed feedback placement improvement over the current end-of-page
message. Do not add a new editor-style dirty/discard guard to auto-saving Settings.

## B. Appearance

Separate **Brightness: System / Light / Dark** from one **Atmosphere** dropdown:
**Automatic / Sunrise / Sky / Evening / Night**. System uses device Light/Dark
appearance. Atmosphere is used across Remilo, including full-screen alarms.
Android notifications keep supported OS styling. The dropdown opens a single-choice
list with visible checked/radio state and readable names; rows grow at large text.
The existing R8 scenic tiles are reference previews, not an additional setting or
required duplicate selector. A36 supersedes the screenshot tile-selector geometry.

Follow [the appearance policy](../appearance-policy.md) for fixed local intervals,
Automatic missing/new preference defaults, manual persistence, brightness preservation,
lifecycle transitions and native session capture. Do not add weather, content
classification, per-task themes, icon matching or a second full-phone preview.

The page previews its selected appearance. Valid changes save automatically through
the existing controller; retained error/saving/retry behavior stays contextual.
Changing selection must not remount controls, reset a sheet/draft or lose focus/scroll.
One native-safe allowlisted mirror excludes titles, notes, lists/categories and
credentials from DP. Storage implementation is TD-02; policy is already decided.

## C. Permissions inline in Settings

Retain three directly actionable rows: **On-time alarms**, **Notifications** and
**Lock-screen alarms**. Ordinary glyphs stay neutral; each row has an explicit
state and an accessible action to the relevant Android settings/request.
Expanded support can show existing app/ringing-channel/reminder-channel data;
that is proposed presentation of current capabilities, not new permission APIs.

| Observed capability | Honest presentation |
|---|---|
| First capability read in progress | Checking with progress. No Allowed success before a result. |
| Exact alarm access absent | On-time alarms Blocked; explain its effect on Alarm scheduling. Notification mode has separate requirements. |
| App notification access or either channel disabled | Notifications Blocked with the specific observed reason. Show Alarm channel and Reminder channel separately when they differ. A blocked reminder channel alone does not mean Alarm-mode scheduling is blocked. |
| Full-screen access absent | Lock-screen alarms Limited; full-screen presentation is unavailable. It is not itself an alarm-scheduling block. Only describe notifications as available if their separate capabilities permit them. |
| Access currently permitted | Allowed means checked access only. It does not prove volume, playback, DND behavior, full-screen takeover or OEM reliability. |
| Initial read failed | “Could not check permissions” + Retry; unavailable states must not look Allowed or remain indefinitely Checking. |
| Refresh failed with an earlier snapshot | Retain earlier states, mark “Last checked …; could not refresh”, and expose Retry. Do not present stale values as freshly verified. |

Use existing Android runtime/special-access handoffs. Returning to Remilo refreshes
capabilities/reconciles; opening Android Settings alone never grants access.
No app-owned Enable toggle, overlay permission or themed mock permission dialog.
Current engine exposes no measured alarm-volume/DND/OEM status, so none is fabricated.

This matches Android's [special-permission flow](https://developer.android.com/training/permissions/requesting-special),
[full-screen access](https://developer.android.com/about/versions/14/behavior-changes-14#secure-fsi-notifications)
and [user-controlled notification channels](https://developer.android.com/develop/ui/compose/notifications/channels).
These sources establish platform constraints; Remilo's three-row arrangement is
our product layout choice. Exact access and notification channels retain their
separate native readiness rules.

## D. Sound selection and preview

Keep the existing **Alarm sound** sheet, two choices **Remilo / System alarm**,
explicit radios, and separate labeled/accessibly named Play/Stop controls.
Selecting a radio changes the default and closes the sheet; Play never selects,
saves, dismisses or creates an alarm. Editor use continues updating its draft only.
Do not add ringtone import, extra tones or a custom waveform player.

Native Starting/Playing/Ended/Interrupted/Failed controls feedback. Only the
current preview's action changes to Stop; selection remains independent. If a
System request falls back, say “Remilo preview playing · System tone unavailable;
using Remilo.” Keep the actual selected radio unchanged. Real alarms take priority.
Preview is native-owned, identified and bounded to five seconds; close, Back,
navigation/background stops it. Failure exposes Play again, or Stop again for
a failed stop request, without changing the selected tone.

## E. Snooze and tomorrow shortcuts

Snooze sheet retains 5/10/15/30-minute presets and Custom minutes, whole number
1–1440. A preset commits automatically and closes; custom text is a local draft
until valid **Use custom duration**. Cancel/Close preserves the saved duration.
Use an inline error for invalid text, keep the entered value, disable the action
without reducing its label contrast, and reveal the control/error above the IME.
The custom action is a picker submission, not a Save for the whole Settings page.

Tomorrow morning/afternoon/evening retain their existing three clock-time pickers.
Baseline values are 10 AM / 2 PM / 5 PM; they are not theme-switching boundaries.
Android's time picker uses actual locale/12-hour/24-hour behavior and retains
platform styling. Cancel preserves the existing shortcut; confirming the picker
submits a validated local time preference. Tomorrow's date/zone resolution and
future-instant validation still occur when Postpone is used, under R6.

For any numeric/text picker: one inset owner and a measured single action footer
above the actual IME; scrolling ends above it. Focus/caret/helper/error remain
reachable, including lower fields, 200% text and taller/emoji keyboards. Do not
theme the keyboard, duplicate Save, shrink controls, or hardcode keyboard height.
Settings and Appearance themselves have no keyboard footer when not editing.

## F. Test alarm and consequential results

Retain **Test alarm** in Alarms, with “Schedule a test in 15 seconds.” A deliberate
tap creates a real native one-off **Remilo test alarm**, at native now +15 seconds,
using current sound/vibration defaults. This is distinct from a five-second preview.
Show Scheduling while in flight and prevent repeated taps for that request.

| Outcome | Feedback / consequence |
|---|---|
| Scheduled | “Test alarm scheduled for Today, 2:00:15 PM” in the held fixture; registration is confirmed, audibility is not. Return a usable actual time from the native result. |
| Blocked | “Test reminder saved; alert blocked.” Add the known capability/registration reason only if actually observed. Preserve the saved reminder; do not substitute Notification mode. |
| Pending | “Test reminder saved; scheduling pending. Check its next alert status.” Pending registration is distinct from a lost command acknowledgement. |
| Rejected | Explain the returned rejection without claiming a saved test exists. |
| Bridge failure / acknowledgement unknown | Explain that the outcome is unconfirmed. Do not label it unsaved, scheduled or safe to recreate. |

Once an occurrence identity is returned, a contextual **View test reminder** link
can open ordinary details (proposed feedback improvement using the existing route).
Stop leaves it unfinished; Done is separate. The test is retained like other
reminders; no automatic deletion, automatic human-success claim, new verification
badge or silent cleanup. The ordinary themed native alarm controls remain R6.

**Implementation gap to resolve before adding Retry test:** current
`scheduleTestAlarm()`/native `testAlarm()` creates a fresh native operation ID per
call. It does not accept a client-captured identity. Calling it again after a lost
reply may create another test. Refine an identified native command/reconciliation
contract and exact-target retry through the existing serialized path; do not treat
it as implemented or draw a casual Retry button wired to the current method.
Pending/lost-result handling must not replace an uncertain job with another test.
There is no lost-ack Retry illustration in this brief; the gap remains adjacent
implementation guidance. Native storage/command changes need their own approved
contract and checks. A new deliberate test after an acknowledged result is distinct
from retrying an uncertain command and must be clearly labeled as a new test.

## Associated image review

These thirteen synthetic references are preserved in the
[readable gallery](../../remilo-r8-settings-appearance/gallery.html), with
[exact identities](../../remilo-r8-settings-appearance/images.json) and
[actual discrepancy notes](../../remilo-r8-settings-appearance/review-notes.json).
A30 accepts the direction/templates available at its response, with R8-08 a later
supplement. Use one realistic readable screenshot per image. At fixed 2 PM, atmospheres are
manually selected review variants; this is not an automatic-switching demonstration.

| ID | Theme / appearance | Capture |
|---|---|---|
| R8-01 | Sunrise Light | Settings upper view: Alarms, clear preference scopes, Permissions entering below. |
| R8-02 | Sunrise Dark | Snooze preference acknowledgement/read failure: last confirmed 10 minutes, contextual error and Retry saving changes. |
| R8-03 | Sky Light | Appearance: Light selected, Sky selected; historical four-tile selector, replaced by A36 dropdown. |
| R8-04 | Sky Dark | Appearance: System selected, device Dark; saving status while fixed Sky remains selected; selector follows A36. |
| R8-05 | Evening Light | Alarm sound sheet: Remilo selected; System preview requested but Remilo fallback playing. |
| R8-06 | Evening Dark | Alarm sound sheet: System selected, playback failed; selection retained and Play available. |
| R8-07 | Night Light | Settings Permissions view: exact/app/alarm channel allowed; reminder channel blocked; full-screen Limited. |
| R8-08 | Night Dark | Settings Permissions view: retained last snapshot with refresh failure and Retry. |
| R8-09 | Sunrise Light | Settings Alarms view: real Test scheduled, actual target and View test reminder. |
| R8-10 | Sky Dark | Test reminder saved/Blocked with observed exact-access denial and reachable permission action. |
| R8-11 | Evening Light | Custom Snooze 0: inline validation, disabled Use custom duration above Android numeric IME. |
| R8-12 | Night Dark | Postpone shortcuts lower view plus actual Android time picker; draft 3 PM, saved afternoon still 2 PM until confirmation. |
| R8-13 | Evening Dark | Test reminder saved/Pending, contextual View, no scheduled success or unsafe Retry test. |

The first eight map one-to-one to all eight R3 references. Equivalent anatomy
inherits the remaining theme/state combinations. Separate snapshots are deliberate:
R8-02 is preference uncertainty, R8-08 capability refresh failure, R8-13 acknowledged
content with scheduling Pending. They must not be collapsed into a generic error.

## Discrepancy guidance and implementation review

The gallery now places inspected discrepancies next to each selected image.
This shared checklist continues to govern those resolutions:

- Equivalent actions use one matching primary/onPrimary pair; ordinary Alarm,
  Sound, permission and time glyphs remain neutral across every page.
- Dark canvas and raised planes match corresponding R3 roles; metadata is neutral,
  not arbitrary blue/purple. Selected checks and labeled status carry meaning.
- Compact secondary art crop, consistent 16 dp geometry, real scalable text and
  unclipped ≥48/56 dp targets override synthetic oversized headers/tiny labels.
- Four preview scenes need names/checks; they do not become four independently
  themed settings sections, clock schedules or per-reminder choices.
- A colored Play/Stop action never changes the selected radio. A green Scheduled
  or Allowed label never certifies audible playback or physical reliability.
- Keyboard, Android permission pages and time picker retain platform behavior.
  Invalid/custom controls/footer remain reachable; root navigation/FAB is absent.
- A27's provisional decorative list icons do not authorize a list-icon picker or
  turn neutral settings glyphs into decorative identity badges.

Observed R8 drift includes different Test/Snooze/shortcut glyphs, neutral icons
accidentally inheriting category hues, taller scenic openings, smaller-looking
Retry/custom-action targets, ordinary support tints and different grouped-row
anatomy behind sound sheets. Targeted image edits corrected consequential state,
layout and color errors; remaining details are recorded in the
[per-image notes](../../remilo-r8-settings-appearance/review-notes.json). In particular,
R8-05's dimmed Vibration disclosure must be the existing boolean switch; R8-13's
rose Pending illustration must use the shared semantic warning role; R8-01's
partial bottom row must clear actual system insets when fully scrolled into view.

The [frozen submission specification](../../remilo-r8-settings-appearance/submission-specification-r1.md)
and [fixtures](../../remilo-r8-settings-appearance/submission-fixtures-r1.json) preserve
the exact pre-generation brief. Their original relative links are archival, not
current source navigation. [Generation evidence](../../../evidence/2026-10-07-r8-images-and-approval.md)
records actual preservation/validation and limits. A36 fixes Automatic policy and
defaults. Storage, native mirror ordering and retry-safe Test command contracts
remain TD-02/TD-03/TD-04 implementation work; UI approval does not implement them.

Actual component review must measure normal-text contrast ≥4.5:1, qualifying large
text and required control graphics ≥3:1, non-color selection/state, TalkBack order,
200% English/Chinese text and real IME/insets. Android recommends ≥48 dp interaction
targets and [scalable, growing text layouts](https://support.google.com/accessibility/android/answer/12159181);
[touch-target guidance](https://support.google.com/accessibility/android/answer/7101858)
supports distinguishing small glyphs from their larger hit region. These are design
requirements, not passing results.

Host/native checks belong to implementation changes; physical permission-return,
sound preview, test audibility, native alarm and pre-unlock behavior remain in the
existing consolidated owner acceptance. [Refinement evidence](../../../evidence/2026-10-07-r8-settings-refinement.md)
records only the checks actually performed for this draft.

## A36 policy correction beside the references

[The gallery supplement](../../remilo-r8-settings-appearance/current-policy.md)
identifies the obsolete tile selector/held Automatic policy without changing accepted
PNG, submission or review-note hashes. The current dropdown and Automatic selection
are approved requirements, not an automatic-switching demonstration in those images.
