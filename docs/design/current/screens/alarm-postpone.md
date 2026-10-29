# Native alarm and Postpone visual specification

The owner's 28 October [uniform Postpone correction](../postpone-chooser.md)
supersedes earlier native quick-Snooze actions and mixed app shortcut rows. It
adds the same eight-tile chooser to native alarms and Reminder Details, with
captured Postpone all and the existing 15-minute opening default. The owner's later
notification follow-up uses Done/Postpone and opens the Home chooser after required
unlock. Legacy Snooze intents and historical accepted reference pixels remain compatible.

The [10 October UX refinement](../ux-refinement.md) updates app-owned Postpone
shortcuts to Tomorrow plus actual clock time, one scope sentence and exact target
preview. Native alarm layout/actions and eligibility remain unchanged.

The [9 October alert experience instruction](../alert-experience.md) supersedes
Stop labels, group actions and overdue semantics here. Approved scene/reference
identities remain unchanged; legacy Stop is command/history compatibility only.

The Done/Snooze and group-action rules here describe ordinary reminders.
[Weekly routines](../weekly-routines.md#native-routine-alarm-presentation) reuse
the shared native appearance with Start routine / Snooze / Dismiss alarm;
groups containing a routine use per-member controls instead of bulk completion.

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

1. A single ordinary native alarm receives a larger scenic opening than Details/Editor,
   with a quiet information surface and two large, immediately reachable actions.
2. Multiple ordinary alarms share one scene and a compact header. Each member owns a
   clearly labeled Mark as done/Postpone pair; Mark all as done (N) and Postpone
   all stay accessible in a separate footer.
3. The ordinary native surface offers Mark as done and Postpone, with matching captured
   group controls. Completion is immediate; Postpone opens the uniform chooser
   and silences the affected delivery only after confirmation. Opening a chooser
   leaves playback and its original five-minute deadline running.
4. Postpone uses a themed, opaque, expandable sheet with shortcut selection,
   a custom date/time option, an exact next-alert preview and one persistent
   confirmation action. Choosing a shortcut does not immediately mutate the alert.
5. Genuine warnings/errors receive labeled semantic roles. Alarm-mode glyphs,
   calendar/time glyphs and ordinary navigation stay neutral.

These presentation templates are accepted with the documented corrections and
A24 background/color condition. The original plain R6-04 remains rejected;
the four corrected themed starting templates are accepted. Existing Stop/Snooze/Postpone semantics,
privacy, native ownership, stale-action rejection and five-minute audio deadline
are preserved. The owner's [production-art abstraction review](../../production-assets/style-decision.md)
is now active; final assets require individual approval.

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
foreground promotion, audio startup or Mark as done/Postpone.

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
- **Action footer:** full-width filled `Mark as done` with checkmark, then full-width outlined
  `Postpone`, each at least 64 dp high, with
  16 dp corners and a 12 dp gap. Use the atmosphere primary/onPrimary pair;
  Done receives the ordinary completion role.
- **Done meaning:** silence and complete the affected occurrence without confirmation.
  Done all completes the displayed captured session members. Snooze/Postpone leave
  work unfinished and never move its original-alert overdue reference.

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
available consequential Event/Due support, and its own filled `Mark as done` plus outlined
`Postpone`. Member actions are at least 56 dp high. They may share a row
when labels fit with at least a 12 dp gap; stack at larger text/narrower widths.
Do not hide the action pair behind a row menu or require opening details first.

For ordinary-only groups, the separate, measured footer contains filled `Mark all as done (N)` and outlined
`Postpone all`, each at least 64 dp high. Done completes and Postpone leaves
unfinished the exact displayed IDs/generations. Later arrivals are excluded.
Validate session and every captured member before mutation. Postpone all captures
the shown set when opened, then confirms one absolute target with truthful per-item results.

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
| Refresh failed with known members | Retain the last known cards/actions; show `Could not refresh alarm controls.` and `Refresh controls`. Refresh does not secretly reissue completion or Postpone. |
| Completion/Postpone rejected | Retain known controls and the action-specific error. Refresh authoritative identity/eligibility before a new deliberate action. |
| Completion/Postpone not confirmed | Freeze the exact command, including operation ID, generations, captured members and absolute Postpone target. Retry action resubmits that command; do not recapture, rebase the target or claim completion/scheduling before acknowledgement. |
| Postpone scheduling partial/blocked/pending | Report truthful member outcomes and keep work unfinished. Do not use a generic success acknowledgement. |
| Confirmed member removed, others remain | Remove only that confirmed member, update count, preserve other targets and shared canvas. Avoid taking focus to an unrelated action. |
| Confirmed terminal session, including timeout | Close an unsubmitted chooser and dismiss the native activity when no submitted command remains unconfirmed. An unknown submitted command retains its frozen recovery view and exact retry. Do not leave an invented ringing state or timeout countdown behind. Unfinished outcomes and eligible follow-up actions live in the app/silent unresolved notification. |

System Back/navigation is not Done. Preserve the current native navigation
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

- Single ordinary ringing delivery offers Mark as done and Postpone from its first
  post and after re-trigger. Content tapping opens native controls.
- An ordinary-only grouped ringing notification opens native per-member controls and includes
  captured Mark all as done and Postpone all actions. Do not invent per-member controls in
  the collapsed system template.
- Unresolved/timeout notifications stay silent and expose eligible Postpone.
  Ordinary Notification mode provides Mark as done/Postpone, stays unfinished on posting/dismissal and never starts
  ringing alarm audio/full-screen UI.
- Public/pre-unlock variants use generic content. Never infer that a private
  notification flag alone proves title redaction on every lock screen.
- Postpone directly opens the app's Home chooser after any required unlock,
  carrying only the captured operational identities. This navigation never submits
  a command or changes sound/deadlines. Routine notification controls are unchanged;
  legacy Snooze PendingIntents remain accepted.

[Android notification guidance](https://developer.android.com/develop/ui/compose/notifications/create-notification)
describes actions, visibility/public variants and urgent full-screen presentation.
[Android 14 full-screen-intent restrictions](https://developer.android.com/about/versions/14/behavior-changes-14)
require capability-aware behavior. These sources support platform boundaries;
the Remilo button/layout proposals above are product choices, not mandated templates.

## E. Postpone sheet and custom time

The [28 October uniform chooser contract](../postpone-chooser.md) owns this flow
in native single/member/group alerts and eligible Reminder Details. Ringing
surfaces and ordinary notifications use Mark as done/Postpone. Notification
Postpone opens this chooser over Home after required unlock; native alarm Postpone
stays in the alarm Activity's window and works without opening private Home content.

Use eight identical tiles in row-major order: 15/30 minutes, 1 hour/1 day,
Tomorrow morning/afternoon, Tomorrow evening/Custom. Use 16 dp corners, 8 dp gaps,
an 80 dp minimum height, shared role colors and a checkmark plus selected outline.
Tomorrow tiles display the saved clock values. Reflow the whole grid into one
column at font scale 1.6 or insufficient measured width. The opaque sheet uses
24 dp top corners and 16 dp gutters, with one exact target preview and persistent
confirmation below the scroller. Retain footer/IME/safe-area fallbacks.

Opening captures scope, device timezone and shortcut values, and selects now plus
15 minutes. Relative selection uses its deliberate action instant; 1 day is exactly
24 elapsed hours. Tomorrow uses the next calendar date at the configured clock
time. Both native and app use the Kotlin resolver with gap-forward/earlier-fold
civil resolution. Confirmation and exact retries use the same concrete target;
waiting/recreation/preference changes never silently rebase it. Expiry requires
another selection. Original Event/Due and overdue references stay unchanged.

Custom opens a provisional Date/Time step. Android picker changes do not select
Custom or submit a command. Use this time promotes a valid target and returns to
the grid; Back to choices discards provisional changes. Android Back closes the
picker, then custom step, then chooser. Closing or selecting never silences sound.
The original five-minute deadline continues; confirmation postpones captured work.

Postpone all captures the shown IDs/generations and fixed count when opened;
later arrivals stay excluded. Stale captured members reject the whole operation.
Before first unlock use generic content and protected operational data only.
Absent upgraded shortcut mirrors disable the three Tomorrow tiles with an unlock
explanation while leaving relative/Custom usable. Unknown commands freeze their
operation ID, scope and target until acknowledged. See the shared contract for
recreation, deferred-session and per-member outcome requirements.

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
roles. Filled Done and Done all use the atmosphere primary/onPrimary;
Postpone/Postpone all use the outlined native action style. Done is intentionally prominent
on ringing surfaces and Details; Postpone retains its secondary outlined treatment.

Native urgent controls are deliberately larger than the ordinary 56 dp app action:
single Mark as done/Postpone and both group actions use at least 64 dp, per-member actions at least
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

## I. Implementation ownership and handoff boundaries

- [AlarmControlsScreen](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmControlsScreen.kt)
  renders captured appearance, member Mark as done/Postpone and both captured group actions.
  Preserve measured footer/scroll fallback and accessible action minimums.
- [AlarmActivity](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt)
  owns snapshots/actions/confirmed dismissal. Refresh controls fetches state;
  Retry action retains the exact unknown command across activity recreation.
  Loading, failed refresh and unconfirmed operations cannot dismiss a live session.
- [SessionSnapshot](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/engine/AlarmEngine.kt)
  carries operational member records, captured atmosphere/brightness and optional
  private title/schedule projection after unlock. Private content never enters
  device-protected storage or derives from `targetMs`.
- [AlarmNotifications](../../../../modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmNotifications.kt)
  uses Done/Snooze or captured Done all/Snooze all with generic public variants.
  Purpose/generation/member/duration identities keep old PendingIntent payloads
  distinct. Android controls actual action visibility; phone observations remain
  in the consolidated acceptance checklist.
- [Reminder Details](../../../../src/app/reminder/[id].tsx) already supplies relative/
  Tomorrow/custom Postpone, future-time validation, and guarded captured-command
  retries, including frozen uncertain commands and truthful scheduling outcomes.
  Ringing Details has Mark as done and Postpone. Sound
  preview retains its separate Stop meaning. Live implementation status belongs
  only in the backlog.

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
