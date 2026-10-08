# Native alarm and Postpone visual specification

Revision 3, 7 October 2026. A22 accepts seven R6 visual templates and rejects the

Consolidated 8 October 2026 under A36. Use [the current index](../README.md).
plain R6-04 alarm. A23 requires softer Dark surfaces matching the existing themes.
[Acceptance and exact identities](../../approved-ui-r6-acceptance.json) and
[the annotated approved gallery](../../remilo-r6-alarm-postpone/gallery.html) preserve
that scope. [A24](../../approved-ui-r6-themed-alarm-acceptance.json) accepts the four
corrected R6-04 Dark atmosphere templates as a starting point, with the condition
that background colors match their corresponding existing themes; detailed
coloring and overall visual polish may change later. Exact native
capture/storage implementation and actual rendered acceptance remain separate;
this is not authorization to execute TD-03/TD-04. Task status remains in
[backlog.md](../../../backlog.md); decisions are in [the ledger](../../approvals.md).

Read [the accepted visual contract](../../approved-ui-r3-r4.md) first. It owns atmosphere,
color roles, shared component geometry and keyboard requirements. This specification
extends those rules to alarm controls and Postpone; it does not replace the
[product contract](../../../product.md) or native scheduling/action authority.

## Accepted visual direction and implementation boundaries

1. A single native alarm receives a larger scenic opening than Details/Editor,
   with a quiet information surface and two large, immediately reachable actions.
2. Multiple alarms share one scene and a compact header. Each member owns a
   clearly labeled Stop/Snooze pair; Stop all stays accessible in a separate footer.
3. The native surface retains Stop and timed quick Snooze. Completion and custom
   Postpone remain in the app's Reminder Details workflow. Opening an editor or
   picker is not required to silence an alarm.
4. Postpone uses a themed, opaque, expandable sheet with shortcut selection,
   a custom date/time option, an exact next-alert preview and one persistent
   confirmation action. Choosing a shortcut does not immediately mutate the alert.
5. Genuine warnings/errors receive labeled semantic roles. Alarm-mode glyphs,
   calendar/time glyphs and ordinary navigation stay neutral.

These presentation templates are accepted with the documented corrections and
A24 background/color condition. The original plain R6-04 remains rejected;
the four corrected themed starting templates are accepted. Existing Stop/Snooze/Postpone semantics,
privacy, native ownership, stale-action rejection and five-minute audio deadline
are preserved. More abstract final artwork remains a later review.

## Shared atmosphere and presentation boundaries

Use the same selected global Sunrise/Sky/Evening/Night atmosphere and independent
System/Light/Dark appearance as the app. A plant category may retain its green
badge when private content is available; it does not select Meadow scenery.
There are no per-reminder environment controls or category-derived backdrops.

For an active native session, capture the resolved global scene and
palette once for that session's presentation. Arrivals, removals, refreshes,
rotation and stopping the first member must preserve that presentation identity,
as well as the existing audio deadline and first sound. A new session resolves
again. TD-02/TD-04 implement the native capture owner and recreation strategy without
changing alarm ownership. The global resolution policy is fixed in the appearance
contract; exact storage fields remain implementation design, not a new schema here.

Before first unlock, keep generic Reminder text, operational alarm time and native
actions, but use the same global themed visual family. Generic content does not
require a plain canvas. No reminder title, notes, list, category, classifier result
or content-derived artwork may enter this presentation.

**Native implementation proposal:** mirror only a minimal allowlisted non-private
global appearance descriptor while credential storage is available; resolve bundled
scene/token assets without React, network or credential reads during Direct Boot.
The descriptor may identify the selected atmosphere and brightness policy, not
reminders, categories, user image paths or arbitrary preference/content blobs.
TD-02/TD-04 verify exact fields, update ordering and compatibility;
[global resolution](../appearance-policy.md) already fixes automatic behavior. Do not copy the credential
database or silently assume a cached scene follows an unimplemented time policy.
[Android Direct Boot guidance](https://developer.android.com/privacy-and-security/direct-boot)
allows required data in device-protected storage while keeping private data
credential-protected; this appearance-only mirror is our proposed application of it.

If no valid safe appearance record exists, resolve Automatic using the current
device-local clock with System brightness, without overwriting a saved preference.
Asset/token failure must retain usable native controls; an emergency rendering is
a failure path, not normal pre-unlock design. Capture the eligible scene once per session and retain it across unlock/content
refresh. The runtime must distinguish credential availability from lock-screen
notification disclosure; post-first-unlock availability does not make private
notification content public.

Sky remains a daytime cloud/lake scene in Dark; Evening remains a sunset with a
sun. A36 fixes automatic time boundaries/defaults in the current appearance policy.
Use the existing softer elevated Dark surface roles: Sunrise charcoal, Sky slate,
Evening plum and Night navy. Do not substitute a harsher near-black alarm palette.
Under A24, both the full-page base/canvas and elevated reading surfaces must consume
the corresponding existing theme's shared semantic roles, rather than guessed
black shades or sampled raster hex values. The owner approves the design approach,
while exact detailed coloring and overall visual polish remain open to refinement.
Scene assets and role values change with theme; component anatomy, icon roles,
typography, information hierarchy and actions remain shared. Single, multiple,
loading, refresh-error and privacy-safe native alarm states support all four
atmospheres in both Light and Dark, without needing a separate generated image of
every combination.

Appearance failure falls back to usable privacy-safe controls and never blocks native
foreground promotion, audio startup or Stop/Snooze.

## A. Single native alarm

Use a full portrait Android surface, initially reviewed at 360 x 800 dp. Keep system
bars/insets real; omit app bottom navigation, Add, edit menus and invented close
or swipe-to-dismiss gestures.

- **Opening:** small Remilo identity and a roughly 200 dp scenic region below the
  top safe inset. This is a maximum composition budget at ordinary text size,
  not a fixed image height. The scene is the same approved landscape family.
- **Information:** an opaque surface with 16 dp gutters/corners, a small category
  badge where allowed, the complete reminder title at about 28 sp, then an explicit
  `Alarm time` value at about 32 sp and `Alarm ringing` / `Starting alarm…` state.
  Do not label the alert target as the Event or Due. Values use `onSurface`;
  ordinary support/glyphs use `onSurfaceVariant`.
- **Timing context:** show the Event range and a consequential independent Due
  when a native credential-safe projection supplies them. Linked/coincident timing
  stays concise. A postponed alert does not overwrite the original Event or Due.
  Do not fabricate these values from the operational alert target.
- **Action footer:** full-width filled `Stop`, then full-width outlined
  `Snooze · 10 min` (actual configured duration), each at least 64 dp high, with
  16 dp corners and a 12 dp gap. Use the atmosphere primary/onPrimary pair;
  Stop receives no destructive red simply because it silences audio.
- **Explanation:** `Stop leaves the reminder unfinished.` stays readable near
  the controls. Done/completion is not implied by a checkmark, button label or
  confirmation animation on this surface.

The footer occupies measured layout space outside the information scroll area.
At large text, long titles, small height or landscape orientation, reduce the art
first, grow/wrap information, and scroll content above the controls. If the action
block itself cannot fit, it must remain scroll-reachable instead of overlapping
content or shrinking labels/targets. Do not ellipsize the only readable title.

## B. Multiple native alarms

The shared opening becomes compact: about 96 dp below the top inset, including
the identity/count heading and a shallow scene crop. `3 alarms ringing` is a
state heading, not a task-completion count. Starting states say Starting rather
than claiming playback is already active.

Use one scrollable column of opaque member cards with 16 dp gutters/corners and
12 dp gaps. Each card contains the complete title, an explicit alert time/state,
available consequential Event/Due support, and its own filled `Stop` plus outlined
`Snooze · N min`. Member actions are at least 56 dp high. They may share a row
when labels fit with at least a 12 dp gap; stack at larger text/narrower widths.
Do not hide the action pair behind a row menu or require opening details first.

The separate, measured footer contains filled `Stop all` at least 64 dp high and
`Leaves all reminders unfinished.` It applies to the captured current session,
not every reminder or later sessions. Preserve the native expected-session guard;
do not add a new confirmation dialog before silence. There is no Snooze all.

Partially visible cards may scroll into view. The footer must not cover their
controls, and TalkBack focus must bring a focused card/action into view. Keep
remaining members independently actionable after a confirmed member removal.
The shared scene must not change when the first member disappears.

## C. Loading, actions, failures and session end

| State | Required presentation and behavior |
|---|---|
| Initial loading, no confirmed snapshot | Generic/last eligible safe background; `Loading alarm controls…`; progress/Retry as applicable. Do not show invented enabled member actions, close automatically, or infer that an empty view means the session ended. |
| Starting with known members | Show known content and `Starting alarm…`; preserve eligible native actions under the existing engine policy. No guaranteed-audibility language. |
| Action in progress | Name the selected action/member, show progress without relayout jumps, and prevent duplicate submissions using the existing native busy guard. Preserve known content and the scene; do not optimistically remove the member. |
| Refresh failed with known members | Retain the last known cards/actions; show `Could not refresh alarm controls.` and `Refresh controls`. Refresh does not secretly reissue Stop/Snooze. |
| Stop/Snooze rejected or not confirmed | Retain known controls, an inline action-specific error, and a refresh route. The next deliberate action uses authoritative refreshed identity/eligibility. Do not claim silence or future scheduling until confirmed; no new native retry protocol is specified. |
| Confirmed member removed, others remain | Remove only that confirmed member, update count, preserve other targets and shared canvas. Avoid taking focus to an unrelated action. |
| Confirmed terminal session, including timeout | Dismiss the native activity under the existing lifecycle contract. Do not leave a full-screen ringing screen or invented timeout countdown behind. Unfinished outcomes and eligible follow-up actions live in the app/silent unresolved notification. |

System Back/navigation is not Stop or Done. Preserve the current native navigation
contract; do not wire incidental UI dismissal to an engine mutation. Post-timeout
follow-up uses the existing silent notification/details route. The five-minute
cutoff is measured from native playback start and is not reset by arrivals or UI
refresh. Missed, Timed out, Interrupted, Failed and Overdue remain distinct.

## D. Supported Android notifications

Use supported Android notification templates and the owned monochrome small icon.
An eligible alarm uses the platform's full-screen/heads-up behavior; permission,
device state and system policy control how it is presented. Do not draw a custom
floating bubble, scene-filled OS banner or app-managed overlay. The global theme
may inform a supported accent; Android controls background, expansion and layout.

- Single ringing delivery retains native Stop and duration-labeled Snooze from
  its first post and after Snooze re-trigger. Tapping opens native controls.
- Grouped ringing notification opens native per-member controls and retains the
  existing session-specific Stop all action. Do not invent per-member controls in
  the collapsed system template.
- Unresolved/timeout notifications stay silent; existing quick Snooze and the
  details route expose eligible follow-up Postpone. Ordinary Notification mode
  keeps its own current behavior and is not presented as ringing alarm audio.
- Public/pre-unlock variants use generic content. Never infer that a private
  notification flag alone proves title redaction on every lock screen.

[Android notification guidance](https://developer.android.com/develop/ui/compose/notifications/create-notification)
describes actions, visibility/public variants and urgent full-screen presentation.
[Android 14 full-screen-intent restrictions](https://developer.android.com/about/versions/14/behavior-changes-14)
require capability-aware behavior. These sources support platform boundaries;
the Remilo button/layout proposals above are product choices, not mandated templates.

## E. Postpone sheet and custom time

Entry is the eligible `Postpone alert` action in Reminder Details, including
eligible ringing/stopped/missed/timed-out/problem states. Quick native Snooze
remains the immediate, duration-based alternative; this draft does not add custom
Postpone to the native alarm activity. Opening the app sheet does not itself
stop sound or mutate Event, Due or the next alert.

Use an opaque themed bottom sheet with about 28 dp top corners, 16 dp side gutters
and a real labeled Close target. Show the title `Postpone alert`, the selected
reminder title, and `Changes the next alert only. Event and due time stay unchanged.`
Allow the sheet to expand to the available height and scroll. Avoid painting a
second landscape inside the sheet; the underlying accepted Details scene provides
identity while the controls retain clean reading surfaces.

Content order:

1. **Relative shortcuts:** selectable `15 min`, `30 min`, `1 hour` controls with
   at least 48 dp targets. Show a check/radio state plus color, not color alone.
2. **Tomorrow shortcuts:** full-width rows displaying the actual configured
   morning/afternoon/evening times. Defaults remain 10 AM / 2 PM / 5 PM; these are
   editable preferences, not fixed theme labels.
3. **Custom date and time:** a neutral calendar/time affordance opening the existing
   Android date/time interaction. Retain the selected draft while opening/returning
   from pickers; returning does not apply the command.
4. **Exact preview:** `Next alert` followed by a full date and time, with relevant
   device-zone/offset context. Make Today versus Tomorrow unambiguous. Display the
   existing Event/Due relationship unchanged; the reminder may still be Overdue.
5. **Footer:** one filled `Postpone alert` at least 56 dp high above the safe area
   and any actual IME. Cancel/Close abandons the local selection before submission.

Opening starts with a future now+15-minute draft, matching the current form.
Selecting a relative shortcut resolves a concrete future instant at selection;
the preview and confirmation refer to that same instant. Waiting must not silently
rebase the target or change a captured command. Re-selecting explicitly calculates
a fresh target; reject an expired/past target at validation and native mutation.
Respect existing device-zone/DST resolution, and show the resolved date/time rather
than promising every wall time exists. This draft changes no time or shortcut policy.

When custom fields or an IME reduce space, use the accepted editor contract:
one inset owner, a measured non-overlapping footer, and visible focused input/caret/
helper/error. Long reminder titles and 200% text may require a full-height sheet.

## F. Postpone validation, results and retry

| Case | Required UI |
|---|---|
| Selection only | No durable mutation, no success message, no alarm cancellation. Selected shortcut/custom state and exact preview are visible. |
| Past or expired selection | Inline `Choose a future time.` beside the custom/preview area; invalid Postpone is disabled, draft remains editable. Do not silently substitute Tomorrow. |
| No longer eligible | Explain `This reminder has no eligible alert to postpone.` Keep current work/status visible; refresh/review without submitting to a different occurrence. |
| Submitting | `Postponing…`; prevent repeat taps and dismissal while the existing guarded operation is in progress. Preserve the captured occurrence, generation, target and operation ID. |
| Acknowledged scheduled result | Return to details with `Next alert postponed to [full date/time]` and truthful current scheduling state. Event, Due and completion are unchanged. Future scheduling is not proof of audibility. |
| Acknowledged Blocked/Pending result | `Saved; alert blocked` / `Saved; scheduling pending` with next target, explanation and Permissions/status route. Do not label Scheduled or show a generic all-clear. Retain feedback in the sheet; replace the submit footer with `Return to reminder`, and allow Close/permission navigation after acknowledgement. A new postponement requires a fresh deliberate selection; acknowledged scheduling state is distinct from an uncertain command. |
| Known rejection | Show native reason, retain the draft, refresh consequential status/eligibility and allow appropriate correction. Never apply the old selection to a new occurrence. |
| Uncertain transport/acknowledgement | `Change not confirmed. Retry the same change before leaving.` Keep selection/target frozen; expose `Retry change` using the same captured command and operation ID. Do not permit replacement, dismissal or a newly based time until reconciled. |

An existing postponed target is a display value, not permission to alter the
original Event or Due. Postpone affects this occurrence only, including within a
repeat family; it does not move the whole family or future ordinary occurrences.
Saving notes/text cannot silently clear a pending postponement.

## G. Shared roles, sizing and accessibility

Use the canonical neutral structural icons and labeled semantic warning/error
roles. Filled Stop, Stop all and Postpone use the atmosphere primary/onPrimary;
Snooze uses its outlined action style. Stop is intentionally prominent on a ringing
surface; Done remains the separate completion action on Reminder Details.

Native urgent controls are deliberately larger than the ordinary 56 dp app action:
single Stop/Snooze and Stop all use at least 64 dp, per-member actions at least
56 dp. All other interactive targets are at least 48 dp and must not overlap.
Use the same 16 dp button corners across appearance; larger alarm controls do not
justify per-theme pills or unrelated fonts. Baseline values are 16 sp, support
14 sp; the single title/alert-time hierarchy above is the deliberate native variant.

Text and controls grow/scroll at system scaling. Artwork has no TalkBack node;
action labels include member context, state and duration. Visible status must have
text/non-color meaning. Do not announce ticking times continuously, steal focus
on every refresh, hide errors behind decoration, or make silence depend on animation.

Measure normal text at least 4.5:1, qualifying large text at least 3:1 and required
control/state graphics at least 3:1 on actual surfaces. Use opaque reading surfaces
or a contrast-protected text area over the scene. Review real 200% English/Chinese,
long titles, narrow/landscape layout, TalkBack and keyboard/inset behavior.
[Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps)
and [Compose accessibility defaults](https://developer.android.com/develop/ui/compose/accessibility/api-defaults)
support contrast and minimum target practices. Raster approval does not verify them.

## H. Reviewed images and accepted themed replacements

Use separate full portrait images, one readable screen each, initially approximately
360 x 800 dp proportions. A22 accepts R6-01/02/03/05/06/07/08 with discrepancy
corrections and rejects R6-04's plain visual treatment. A24 accepts four corrected
Dark starting templates for Sunrise/Sky/Evening/Night using the same privacy-safe
layout, subject to matching their existing theme's background/color roles and
later detailed coloring/visual polish. Every component must support
the four global atmospheres in Light and Dark.

| ID | Screen | Fixture and treatment |
|---|---|---|
| R6-01 | Single native alarm — Sky Light | Water plants; alarm 10:00 AM; Event 10:00–10:15 AM, linked Due; known Active state; Stop and Snooze 10 min. Larger scenic opening with opaque information/actions. |
| R6-02 | Multiple native alarms — Night Dark | Clock 9 PM; Take medicine, Call dentist and long proposal title all alerting. Call dentist Event 9:30–9:45 PM/Due 10 PM independent of alert 9 PM; proposal Event 4–4:30 PM/Due 5 PM overdue. Member actions plus Stop all; no countdown or per-member environments. |
| R6-03 | Multiple alarms with refresh failure — Evening Dark | Same known members, long title and retained actions; inline refresh error and Refresh controls; partial lower card scroll is acceptable, covered actions are not. |
| R6-04 | Privacy-safe themed alarm before first unlock — four atmospheres | Plain submission rejected. A24 accepts the four corrected Dark starting templates, with matching corresponding-theme background/color roles and later visual polish. Generic Reminder/Alarm ringing, operational alarm time and Stop/Snooze 10 min use bundled global scenery/shared tokens from a safe source; no category/private content/credential read. Light remains required component support. |
| R6-05 | Postpone shortcuts — Sky Light | Fixed review clock 9:30 PM, unfinished proposal Event 4–4:30 PM/Due 5 PM, stopped alert. Select 30 min: preview Today, Wed 7 Oct, 10 PM. Show actual Tomorrow 10 AM/2 PM/5 PM preferences and Custom option. |
| R6-06 | Custom Postpone — Evening Dark | Same reminder/clock; custom Tomorrow, Thu 8 Oct, 9 AM selected. Event/Due still overdue; this 9 AM is a custom choice, not the default morning shortcut. |
| R6-07 | Invalid custom Postpone — Sky Light | Same 9:30 PM clock; Today 8 PM selected, future-time validation visible and confirmation disabled. Preserve draft/underlying Overdue rather than hiding difficult content. |
| R6-08 | Postpone acknowledged but blocked — Night Dark | Same reminder; next alert Tomorrow 9 AM saved but blocked. Keep truthful feedback, Permissions route and unchanged overdue Event/Due. This is not an uncertain retry or successful audibility screen. |

The frozen fixture clock deliberately allows a selected Sky/Evening theme at night;
it does not propose automatic period boundaries. Use [the fixture brief](../../r6-alarm-postpone-fixtures.json)
for exact words/values when generating images. Labels and glyphs must obey the
canonical roles; annotate any generation drift rather than treating it as policy.

## I. Current implementation gaps and handoff boundaries

- [AlarmControlsScreen](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmControlsScreen.kt)
  currently supplies native actions and generic rendering, with optional review
  composition slots. It does not implement this new global atmosphere/layout.
  Its default multi-member footer is part of the scroll content, not proof of the
  proposed measured persistent footer. Preserve rendering/action ownership.
- [AlarmActivity](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt)
  owns snapshots/actions/confirmed dismissal. Its Retry refreshes controls; it is
  not a same-operation retry for native Stop/Snooze. Do not confuse it with the
  app Postpone retry. Appearance/capture changes need reviewed lifecycle contracts.
- [SessionSnapshot](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt)
  currently carries operational records/title pairs and brightness, without the
  proposed global atmosphere descriptor or full Event/Due/category projection,
  including the proposed minimal non-private Direct Boot appearance mirror.
  Add any required private projection through authorized native boundaries after
  unlock, not JS, device-protected storage or inference from `targetMs`.
- [AlarmNotifications](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmNotifications.kt)
  has current Stop/Snooze/session Stop all actions and PRIVATE visibility. Explicit
  generic public-version treatment still needs review/verification; flag choice
  alone is not proof of the proposed public presentation.
- [Reminder Details](../../../../src/app/reminder/[id].tsx) already supplies relative/
  Tomorrow/custom Postpone, future-time validation, and guarded captured-command
  retries. The proposed sheet geometry, selection indicators, exact preview and
  keyboard-aware persistent footer require actual component implementation.
  Current sheet Close checks in-progress commands but does not by itself retain
  the uncertain result context; the proposed uncertain-state dismissal guard and
  acknowledged Blocked/Pending result footer require explicit refinement too.

Eleven R6 reference images are accepted with corrections: seven A22 workflow
templates plus four A24 themed alarm starting templates. The original plain
alarm remains rejected. No app/native code, storage migration, build or installation
is performed by this visual review. TD-03 owns the app Postpone flow; TD-04 owns native controls
and notifications, with TD-01/TD-02 appearance integration. This cross-screen
contract now belongs to TD-03/TD-04; backlog alone records implementation status.
Before implementation, refine and review the exact native capture/storage/failure
contract; preserve the already accepted visual layout. Record actual component
renders separately from synthetic image review. Native
action/race/privacy regression evidence and signed phone observations remain in
the existing consolidated verification process.
