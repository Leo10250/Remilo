# R8 — Settings, Appearance, permissions and Test alarm

Revision 1 · 7 October 2026 · **Design-review proposal; images not generated.**

[A28 intake](r8-settings-appearance-intake.json) records the owner's continuation
request and explicit requirement to use every R3 image for style while preserving
established UX. This review batch follows the accepted R7 outline; it is not a
new implementation milestone. [Fixtures](r8-settings-appearance-fixtures.json)
define thirteen readable candidates for a later image review.

## Authority and boundaries

Use [the canonical direction/corrections](approved-ui-r3-r4.md), all eight
[R3 references](remilo-r3-atmospheres/gallery.html), and the accepted R4–R7
secondary-screen, color-role and keyboard rules. [Product](../product.md),
[architecture](../architecture.md) and existing native actions govern UX.
The owner's latest global-theme direction overrides old task-specific appearance.

This draft refines composition and feedback. It does not implement routes,
settings storage, native commands, automatic switching or migrations. Existing
Settings already supports automatic preference saving, inline permissions,
sound preview, Snooze duration, tomorrow shortcuts and Test alarm. The proposed
dedicated Appearance page and four saved global atmospheres belong to
[P04A](../plans/redesign/p04-fixed-appearance.md); automatic behavior belongs to
[P09](../plans/redesign/p09-time-appearance.md). Concrete persistence, descriptors,
legacy/default handling and pre-unlock appearance still need technical refinement.

Current production `theme` means System/Light/Dark brightness only. R8 does not
rename its persisted values, choose a fresh-install atmosphere, replace a legacy
Classic preference, expose manual reminder appearance, or silently map the old
five-period model onto four scenes. Automatic switching remains a later policy
review, with no enabled Automatic toggle or invented switch times in these images.

## All eight visual references

Every R8 component/state supports all four atmospheres in both appearances.
Different candidates exercise different pairs, rather than require every possible
state/theme permutation. Brightness is independent of scene identity.

| Atmosphere | Light reference and shared roles | Dark reference and shared roles |
|---|---|---|
| Sunrise | [01](remilo-r3-atmospheres/01-sunrise-light.png): peach/gold sunrise, mountain lake/conifers; warm off-white canvas, white raised surfaces, burnt-orange primary/light content. | [02](remilo-r3-atmospheres/02-sunrise-dark.png): same sunrise identity; soft charcoal canvas/raised charcoal, pale-apricot primary/dark content. |
| Sky | [03](remilo-r3-atmospheres/03-sky-light.png): clear blue clouds, lake and green banks; pale cool-blue canvas/white surfaces, saturated-blue primary/light content. | [04](remilo-r3-atmospheres/04-sky-dark.png): same daytime scene, darker quiet sky; blue-slate canvas/raised slate, pale-sky-blue primary/dark content. |
| Evening | [05](remilo-r3-atmospheres/05-evening-light.png): coral/rose sunset, sun/reflection and purple mountains; pale rose/off-white canvas/white surfaces, muted-plum primary/light content. | [06](remilo-r3-atmospheres/06-evening-dark.png): same sunset identity; plum-charcoal canvas/raised plum, pale-rose primary/dark content. |
| Night | [07](remilo-r3-atmospheres/07-night-light.png): crescent/stars, moonlit blue lake; icy-blue canvas/white surfaces, deep-blue primary/light content. | [08](remilo-r3-atmospheres/08-night-dark.png): same moonlit identity; navy-slate canvas/raised navy, pale-periwinkle primary/dark content. |

Use matching shared canvas **and** elevated-surface roles under A24. No independent
Settings black, sampled PNG hex, glass reading card, or new scenic interpretation.
Sky Dark retains daytime clouds; Night Light retains moon/stars above a Light
reading plane. Reuse one selected scene asset/crop policy across pages; final art
abstraction is deferred. Settings glyphs, chevrons, ordinary values and helper text
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
| Brightness / global atmosphere | Presentation only; no event/due/alert or completion effect. Four-atmosphere persistence is proposed P04A work. |

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

The proposed page separates **Brightness: System / Light / Dark** from
**Atmosphere: Sunrise / Sky / Evening / Night**. Name System explicitly and explain
“Uses your device's light or dark appearance.” Label the other group “Atmosphere”
and explain “Used across Remilo, including full-screen alarms.” OS notifications
keep their supported Android presentation; no scenic-notification guarantee.

Use explicit radio/checked selection, not color alone. Brightness choices fit
stacked growing rows; avoid three cramped text chips at large font sizes.
Atmospheres use four named scenic tiles in a two-column grid at ordinary width,
falling back to one column at large text/narrow space. A tile has its cropped
scene, readable opaque name band, visible selected check/radio and at least a
48 dp target. Tile artwork previews all four scenes; the surrounding page and
actions still use the current global atmosphere/appearance. Selecting a tile is
an intentional preference change; merely scrolling/viewing it does not save.

The current page itself previews the selected appearance. No second full-size
phone preview, separate theme browser, required confirmation footer or per-task
chooser is needed. Auto-saving/saving/error/rollback use the same controller and
feedback as other preferences. Update colors/art without remounting controls,
losing focus/scroll or resetting a sheet/draft. Pending animation never makes
selection ambiguous; reduced motion uses an immediate coherent update.

Before implementing fixed selection, refine native IDs/descriptors, compatibility,
unknown-value fallback, missing/legacy settings paths and the safe non-private
pre-unlock appearance mirror with P04A/P08. Device-protected storage must exclude
titles, notes, list/category identities, credentials and content-derived choices.
No CE read, classifier, network or React dependency may enter alarm startup.

**Policy still open:** how four scenes map to automatic local-time bands, exact
boundaries, opt-in/defaults, upgrades, zone/clock changes and transient/session
capture. Put this in review notes, not technical warnings inside normal product
UI. Do not draw an enabled unavailable control or claim the feature was removed.

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

## Next image review

These are proposed captures, with no generated PNGs or owner acceptance yet.
Use one realistic readable screenshot per image. At fixed 2 PM, atmospheres are
manually selected review variants; this is not an automatic-switching demonstration.

| ID | Theme / appearance | Capture |
|---|---|---|
| R8-01 | Sunrise Light | Settings upper view: Alarms, clear preference scopes, Permissions entering below. |
| R8-02 | Sunrise Dark | Snooze preference acknowledgement/read failure: last confirmed 10 minutes, contextual error and Retry saving changes. |
| R8-03 | Sky Light | Appearance: Light selected, Sky selected; all four named scenic choices visible. |
| R8-04 | Sky Dark | Appearance: System selected, device Dark; saving status while fixed Sky remains selected. |
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

After generation, inspect each selected image and put actual discrepancies next
to it. Until then this is a checklist, **not** claimed observation:

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

Actual component review must measure normal-text contrast ≥4.5:1, qualifying large
text and required control graphics ≥3:1, non-color selection/state, TalkBack order,
200% English/Chinese text and real IME/insets. Android recommends ≥48 dp interaction
targets and [scalable, growing text layouts](https://support.google.com/accessibility/android/answer/12159181);
[touch-target guidance](https://support.google.com/accessibility/android/answer/7101858)
supports distinguishing small glyphs from their larger hit region. These are design
requirements, not passing results.

Host/native checks belong to implementation changes; physical permission-return,
sound preview, test audibility, native alarm and pre-unlock behavior remain in the
existing consolidated owner acceptance. [Refinement evidence](../evidence/2026-10-07-r8-settings-refinement.md)
records only the checks actually performed for this draft.
