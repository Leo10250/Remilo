# Verification and release evidence

Permanent Trash deletion requires a signed Android check of single-item and selected
confirmation, Cancel/Back, changed/restored rejection, unknown-reply retry and return
from deleted-reminder details. Verify unrelated occurrences and the repeating plan
remain, the purged occurrence stays absent after restart, and backup export/restore
retains exclusions. Host tests cover CE migration, atomic removal, crash boundaries,
retry identity, recurring recovery/Direct Boot and v1–v4 backup reading; those checks
do not establish Android sheet/accessibility acceptance.

The themed Move to Trash and editor timing corrections also need signed-phone
observations: Cancel/Back retains unfinished work; Date and Time open independently
and preserve the other component; all-day shows Date only; a confirmed move has
one snackbar with revision-safe Undo and no permanent inline success. Check normal
expiry, Android's extended accessibility timeout, touch interruption and TalkBack
explicit dismissal. Host timer tests and web fixture review do not pass these gates.

Run npm run verify for shared checks, npm run verify:android for native checks,
npm run verify:device for preflight and a pending observation report, and
npm run build:beta for the locally signed bundled release. All manual observations
start pending; collecting adb output does not prove audible behavior.

Manual acceptance evidence records timestamp, build variant, device/OS, permissions,
scenario, result, measured duration and observer. Record APK identity and source
commit when that relationship is established; optional tool reports do not infer
source or require those fields. Store private local reports in ignored
verification/local; commit only explicitly redacted evidence.
The owner's consolidated offline Android run is in [device-acceptance.md](device-acceptance.md).
Use it for one batch of manual results; do not resume repeated unlock/test questions
unless the owner asks. Technical fault/OS coverage remains separate and pending.
Optional preflight distinguishes the local APK hash from the installed APK hash.
Missing or mismatched artifacts are diagnostic results; transport or inspection
errors fail the command. No receipt is required. The current workspace commit is
not evidence of an APK's source; when recording release evidence, explicitly state
the source/build relationship observed rather than inferring it from preflight.
Preflight never installs or changes the phone.

## Development workflow and private evidence

`npm run deploy` is the daily build/install command. It checks prerequisites,
selects a target and ABI, assembles with the existing beta signing key, inspects
the resulting APK once and updates Android user 0 using `install -r`. It leaves
the UI closed unless `--launch` is requested. Android's installer enforces update
compatibility. Deploy reports ADB installation success separately from optional
launch; it does not pull the installed APK or compare installed hashes. Cancellation
during installation is uncertain and must not be automatically retried.

Deploy accepts only `--device SERIAL`, `--launch` and `--help`. It does not require
receipts, fingerprints, Git metadata or prior verification. Run only one
release-producing command at a time per checkout; concurrent build/deployment is
unsupported. Old ignored receipts or lock files are historical local artifacts,
not inputs to the current commands. Default deploy does not rerun the full tests.
Neither successful installation nor a matching APK hash establishes physical alarm
acceptance.

`npm run release:prepare` runs shared/tooling checks, native unit tests and lint,
then assembles and inspects a required signed APK. It writes a private summary of
actual completed checks and artifact identity, links the owner checklist and leaves
physical observations pending. It does not install or publish. `verify:all` can
assemble an unsigned CI build. Use `--abi x86_64` for those commands when preparing
that architecture. Keep release evidence tied to the actual tested build; do not
edit sources while checks/assembly are running.

`npm run verify:device` is optional diagnostic preflight. Its private report records
selected device/model/API/ABI and available local/installed hashes, with matching,
mismatched or unknown identity. It does not attribute source or pass physical gates.
Run it when inspecting installation identity, not as a compulsory deployment step.

`device:logs` saves up to the last 2,000 log entries filtered to `Remilo:I`;
`--follow` streams until Ctrl+C. It filters by tag rather than PID so process
restarts remain visible, and never clears the log buffer. `device:capture` writes
binary PNG output without unlocking, navigation or temporary device files.
Both accept `--device SERIAL`. Keep their logs/screenshots and serials local;
there is no automatic upload. Do not infer human audibility from either artifact.

Doctor, devices and preflight support structured JSON. Use npm's
`--silent` option to suppress its banner. All scripts offer `--help`. Read-only
device commands can contact the shared ADB server, but never restart it, pair
wireless devices or create emulators.

Host toolkit tests use controlled device/process fixtures. The milestone does not
initiate phone deployment or another alarm-testing sequence. The simplified
command's owner smoke and the consolidated physical checklist remain separate
pending work; earlier deployment evidence retains its historical scope.

## G0: foundation

### Current design verification

Read [the current design](design/current/README.md), [coverage](design/current/coverage.md),
[appearance policy](design/current/appearance-policy.md) and [TD roadmap](plans/redesign/README.md).
R3 all eight images govern style. Approved templates/corrections govern R4/R5/R6/R7/
R8/R10; [R9 runtime composition 05 has owner approval for implementation](design/r9-runtime-composition-approval-v5.json),
separate from its historical A31 draft and four rejected runtime candidates. Final artwork abstraction and
actual production tokens/measurement are separate from raster approval.

Documentation and cleanup verification checks active links, JSON, all protected
reference-bundle hashes, gallery resources, retained backlog rows and the exact
removal manifest. Superseded catalog/demo tests are removed with their subjects.
`npm run verify:design` runs the protection/removal/link audit; `npm run verify`
includes that audit before shared checks. CI fetches the recorded baseline history
so the deletion audit also covers committed changes.
For later authorized runtime work, explicitly revise the implemented-source
baseline for that unit while retaining reference protection and behavioral tests.
Do not regenerate accepted artifact identities to conceal unintended changes.
Production behavior tests and ordinary web-preview/Android bridge isolation remain
required. Run the shared and Android checks for cleanup code/tooling changes;
record actual results separately from pending physical observations.
Frozen submissions can cite removed specifications as provenance. Resolve those
citations through the recorded Git revision, without recreating obsolete specs.

For TD-01/03, validate matching canvas/elevated roles and consistent neutral form
icons, atmosphere actions and labeled category/status colors in all eight pairs.
Use shared 16 dp gutters/corners, 16 sp values/14 sp support, >=48dp ordinary targets
and >=56dp app prominent actions. R6 native single/Stop-all actions remain >=64dp
and member actions >=56dp. Measure actual contrast: normal text 4.5:1, qualifying
large text 3:1 and required control/state graphics 3:1.

The [alert experience correction](design/current/alert-experience.md) changes those
native labels to Done/Done all and adds Snooze all at the same 64 dp minimum.
Terminal cards use borderless 24 dp More in a separate 48 dp target, with no work
completion controls outside explicit selection. Inline Alert choices remain
visible and stack at 200% text. Measure actual component keylines/wrapping/targets.

Capture real Android Title creation and lower Notes/caret/validation editing at
360x800 and 200% English/Chinese text. One Save sits above actual IME, outside form
scrolling, with measured footer clearance and one inset owner. Test emoji/taller
keyboards, multiline selection/composition, first-tap Save, Back, rotation and
uncertain/stale draft preservation. Static screenshots prove none of these behaviors.

TD-02 tests local 06/10/17/21 edges, midnight/DST/clock/zone changes, manual overrides,
Automatic missing/new defaults, preserved brightness, long foreground absence and
coalesced transient updates. Never change reminder target/generation/history as a
cosmetic side effect. TD-04 freezes native session appearance through member and
unlock changes; use privacy-safe native resolution without CE/React/network reads.
Retain direct Stop/Snooze/Stop-all, deadline/race checks and OS notification limits.

TD-03 retains whole-backup inclusion/identity conflicts, no-overwrite separate-copy
choices, frozen same-operation Restore retry and truthful Scheduled/Pending/Blocked,
share handoff, receipts and diagnostics. Preserve R9's explicit composition 05
approval and the fixed icon-free list decision; actual Android layout/accessibility
observations remain pending. TD-05 validates faithful
static Classic exports/masks/small sizes without app-controlled aliases.

TD-06 integrates code-appropriate shared/native checks and a signed artifact with
[the consolidated owner run](device-acceptance.md). Preserve existing G1/G2/G3 tests
and observed limitations. Record failures/unobserved cases; host checks and image
approval never imply physical release verification.

## G1: physical native alarm proof

| Scenario | Expected |
|---|---|
| Close UI/kill ordinary process, remain offline | native alarm fires without JS |
| Another foreground app | actionable authorized presentation; no forced overlay |
| Locked/screen off | native alarm surface where permitted |
| Reboot, do not unlock | generic delivery and native Stop/Snooze |
| Ignore alarm five minutes; force idle/screen off | cutoff; no automatic repeat |
| Alarm Stop / Stop all | affected occurrence(s) completed, sound ends; future repeat slots retained |
| Snooze; invoke old Stop/callback | new generation unaffected |
| Re-trigger after a full ten-minute Snooze | first notification includes current Stop/Snooze; both are usable |
| Fail processing earlier independent alarm | later alarm remains registered |
| Crash at persistence/registration/action boundaries | idempotent recovery, no cancelled replay |
| Kill process during ring, reopen/reboot | interrupted session remains silent |
| Grant/revoke exact permission | cancelled/blocked status and reconciliation |
| Deny notifications/full-screen | honest controls/presentation capability |
| Calls/focus/volume/Bluetooth | original deadline and honest audio outcome |

Active Apps Stop and force-stop are separate expected-limitation scenarios.
Force-stop does not prove ordinary cold-process failure. Private Space restrictions
are documented, not guessed from app readiness. An emulator never verifies audibility.

### Reproducible phone procedure

1. Run host verification, commit the source and build the signed release; record
   source SHA, APK SHA-256 and signer. Install for the primary Android user, without
   removing existing data. Record actual OS/API and permission conditions.
2. Open the bundled UI offline. Use Remilo's permission buttons and observe Android's
   dialogs/settings. Refresh readiness; verify saved-but-blocked behavior before grant.
3. Create a 15-second Test Alarm. Press Home, use `adb shell am kill --user 0
   com.remilo.app` for an ordinary background process, and confirm its PID is absent
   before delivery. Never substitute force-stop for this test.
4. Capture only Remilo's logs. A new process, native-only startup, an Active session
   and a foreground native service establish execution evidence. Human confirmation
   establishes audibility and actual presentation. They are different observations.
5. Use the native screen/notification Stop and Snooze, without opening the principal
   UI. Check the resulting generation/state and next target when the UI is reopened.
   Check the initial notification, the expanded panel and the notification after
   a full ten-minute Snooze. Record compact popup rendering separately from the
   notification's actual actions; Android controls collapsed/expanded presentation.
6. For cutoff, leave a session untouched for five minutes with screen off. Record
   Active elapsed/deadline and Playback stopped elapsed/reason from native logs.
   Include a forced-idle case; confirm sound ends and remains silent independently.
7. Schedule a sufficiently distant alert, reboot and keep the phone locked until it
   fires. Verify generic controls and quick Snooze before first unlock, then reconcile
   content/history after unlock. Do not infer this from a simulated user-lock test.
8. Test other-app presentation, permission changes, collisions, interrupted actions,
   Active Apps Stop and force-stop separately. Restore temporary test settings and
   avoid leaving armed test reminders. Do not overwrite unrelated data/alarms.

Use primary-user flags where applicable; `pm list packages` without `--user 0` can
fail on phones with locked additional profiles. Never bypass phone credentials.
Private screenshots/XML/logs stay in verification/local or .tooling. Commit only
redacted outcomes, not device serials or unrelated notification contents.
Before first unlock, external storage is unavailable. Use a task-owned file under
`/data/local/tmp` for UI evidence, check dump/pull success and never read a stale
local file after a failed pull. Remove temporary device files afterward.

### Owner-operated recovery checks

Finish an ongoing Snooze test before starting these checks. The owner operates
the phone; adb collection is read-only unless a separate automated test is agreed.
Use distinct probe titles and record the signed build/hash. Do not clear app data.

**Independent alarms and interruption:**

1. Create "Recovery A" with an alarm in one minute, then "Recovery B" in three
   minutes using the quick form. Leave Remilo and open Settings.
2. When A rings, open Android's Active Apps control from the notification panel
   and stop Remilo there. This is the system's active-app Stop, not Remilo's alarm
   Stop and not Settings > Force stop. If the control is unavailable, record that
   and leave the case unverified; do not substitute a different operation.
3. Confirm sound ends. Leave the phone untouched until B's original target.
   B must still ring. Stop B with Remilo's native control.
4. Open Remilo. A should be Interrupted and unfinished; B should be Completed. A must not resume sounding. Confirm this across another reopen.

Android documents that Active Apps Stop removes the process and media playback,
while scheduled alarms remain eligible to fire. This is the platform expectation
behind this procedure, not a passing result for Remilo:
[Android user-initiated stopping](https://developer.android.com/develop/background-work/services/fgs/handle-user-stopping).

**Exact-access recovery:**

1. Create "Permission probe" three minutes ahead. Through Remilo's exact-alarm
   permission button, turn access off, then return to Remilo.
2. Refresh. Readiness and the saved reminder must show delivery blocked, without
   deletion or a silent notification-mode substitution.
3. Re-enable access before the target, return and refresh. The reminder should
   become Scheduled and ring at its original target. Stop it normally.
4. A separate elapsed-target case leaves access denied until after the target.
   Re-enabling/reopening must mark it Missed silently, rather than replay it.

**Force-stop limitation and past recovery:**

1. Create "Force-stop probe" three minutes ahead. Open Android's app settings
   for Remilo, choose Force stop and confirm Android's prompt.
2. Leave Remilo closed past that target. No alarm is expected under force-stop.
3. Reopen it after the target and refresh. The elapsed reminder should be Missed
   and remain silent. Keep this result separate from ordinary process death and
   Active Apps Stop.

Observe focus/call/routing changes separately. Never place calls or start unrelated
media on the owner's behalf. Bounded automated fault tests are still required for
write boundaries and obsolete PendingIntent callbacks; these manual procedures
do not claim to cover those conditions.

## Later gates

G2: Stop/Done completion and stale-action races, all postponements after timeout, independent colliding occurrences,
settings, restore preview, upgrade safety, no credential/runtime backup transfer.

G3: rule fixtures, invalid dates/count, DST/travel, edits/skip/pause, preserved
postponement collisions, accessibility and API 34–37 matrix. Another OEM phone is
required before broad manufacturer claims.

G4: scoped Calendar writes, both directions, etag conflicts, retry identity,
cancelled instances, supported recurrence mapping, pagination and 410 recovery.

G5: disconnected changes/convergence, normal and offline primary handoff, logout,
Calendar writer separate from ringing role. G6: real-iPhone behavior, documented
limits, widget/countdown integration and visible coverage. No early iOS testing.

## Shipped 0.4.0 UX refinement observations

The layout references in this section describe earlier pending baseline checks.
For TD-06, use the current Agenda / Lists / Completed / Trash roots, Repeats within
Lists, secondary origins and
leading completion target while retaining the underlying behavior/recovery tests.
Browse and trailing completion below are historical layout, not new requirements.

Host checks cover native query/conversion/action contracts and focused TypeScript
domain logic for route selection, revision-safe Undo, civil draft conversion,
conflict review, recurrence summaries and exact restore retries. The current test
stack has no React Native render/hook harness. Source review and domain checks do
not establish Android keyboard/Back ordering, picker behavior, accessibility focus
or physical alarm delivery. Record actual host results in the task evidence rather
than treating this contract as a passing report.

Add these observations to the owner's consolidated signed-phone acceptance run;
they remain pending until observed on the identified bundled build:

- Save one-off and repeating reminders; confirm return to Agenda and contextual
  acknowledgement, including blocked/pending warnings and the View action. Open
  one-off Edit directly and confirm repeating Edit asks for scope.
- Use date/time and city/region pickers with pinned and floating zones. Check
  independent due/alert times, all-day boundaries, zone changes across dates,
  daylight-saving gaps/folds, and an untouched existing later-fold instant.
- Apply and cancel Custom repeat; inspect preview, intervals, weekday selections,
  ordinal rules and date/count endings. Review stale local text/timing/repeat drafts
  against external changes and recover a replaced series segment.
- Exit Agenda search with Android Back both while the keyboard is visible and
  after it closes. Clear query separately. Exercise Back and close controls in
  nested sheets; confirm cancellation keeps the previous applied rule.
- Find all Browse destinations, each repeat family and its earlier unfinished
  occurrences. Search/filter Completed and Trash, inspect newest history ordering,
  and restore/reopen without replaying elapsed alerts.
- Complete from the trailing row action and optional swipe, then Undo. Change the
  same item before Undo and confirm the newer change is preserved. Confirm Trash
  requires acknowledgement for unfinished work; completed Trash is recoverable
  without a modal. Check revision-specific Trash Undo, Restore destinations and
  native Stop completing only the current occurrence.
- Open Custom Postpone repeatedly and confirm it starts in the future. Reject a
  past target without mutation; accept a future target and retain other members'
  actions and targets.
- Cancel file selection; preview a valid backup; distinguish Reading from Restoring.
  During a lost import reply, verify copy/file controls and Back are guarded and
  Retry submits the same operation. Check acknowledged blocked-alert warnings.
  Refresh/retry diagnostics and dismiss/complete the system share sheet; feedback
  must describe only the observed share-sheet outcome.
- Check light/dark appearance, 200% font size, TalkBack and reduced motion. Confirm
  at least 48 dp targets, wrapping app bars, meaningful state labels, sheet focus,
  disabled controls during uncertain saves, readable feedback and reachable bottom
  actions with the keyboard open.

These UI observations supplement [device-acceptance.md](device-acceptance.md) and
the native G1–G3 gates. They do not replace the pending audibility, pre-unlock,
recovery, five-minute cutoff or manufacturer coverage evidence.

## Shipped second-refinement consolidated observations

This retains the earlier build's pending observations. Its Browse references are
baseline history; current TD-06 applies the same behavioral checks through the
approved roots and invoking-origin navigation.

The second refinement adds content schema 4 and backup format 3; operational schema
stays 3. Native upgrade, retained-template membership, restore retry, No alert
recovery, filtered pagination and identified preview tests are host evidence.
They do not establish phone audio, navigation or migration acceptance.

On the identified signed bundled build, check Browse from every destination,
current-item dismissal, independent destination state, origin return and Android
Back ordering with sheets/search/drafts/uncertain operations. Create and manage
empty lists; rename/remove without changing alert times, save from a list and
inspect its Completed/Trash. Review restored names in backup preview.

Check stopped-overdue, adjusted, blocked, No alert and paused/ended exception
wording, conditional Schedule details, recorded Activity and persistent state
actions. Preview both sounds without changing selection, switch/stop, close/Back,
leave/background, and let a real alarm interrupt preview. Record actual tone,
fallback and playback failures separately from accepted start requests. Include
light/dark, 200% text, TalkBack, reduced motion and keyboard reachability alongside
the existing native time-zone/DST and alarm reliability matrix.

## Beta-fix acceptance additions (9 October)

The later [alert experience correction](design/current/alert-experience.md)
supersedes Stop wording and due-based expectations in these scenarios. Add tests
for CompleteDelivery on ringing/Notified, exact displayed DoneAll/SnoozeAll members,
later arrival exclusion, stale precommit rejection, current duration changes,
partial scheduling, crashes between protected commit/registrations/CE projection,
same-command retries after restart/Reopen and silent elapsed recovery. Verify
original alert separately from next delivery, strict overdue boundaries/counts/
pagination, No alert When/end-of-date DST and hidden-alert recurrence offsets.
Retain old command/backup compatibility and historical Stopped records.

Use the [beta contract](design/current/beta-fixes.md) and identify the signed APK
and source snapshot before physical observations. Host fixtures never establish
Android lifecycle, native Animated performance, actual IME/TalkBack, splash or
alarm eligibility. The consolidated acceptance arrangement remains in force.

- Stop: one-off/finite repeat, after Snooze, individual/all, Direct Boot then
  unlock, stale generation/session, Stop/Done race, crashes around both storage
  commits, identical retries and Reopen after completion. Verify one Done with
  the original Stop timestamp; retain historical Stopped as unfinished.
- Agenda: independent event/due/alert dates, overdue tomorrow Postpone, No alert,
  intended/pending/blocked/paused/missed/notified states, midnight/DST/device zone,
  more than 50 rows, stable equal-time ID order and full counts before pagination.
- Navigation: all four roots; scoped collections, Lists → Repeats → family →
  occurrence and return; existing /series links and legacy origin; separate
  search/filter/scroll snapshots; selection, IME/sheet and uncertain-job Back.
- Covers/targets: fixed image bounds/crop while opaque content covers decoration;
  pinned toolbar and no full reopening during small upward reading adjustments.
  Check expanded/covered/restored positions, empty/short pages, eight appearance
  pairs, 360×800, landscape, 200% English/Chinese, reduced motion and TalkBack.
  Check list name/support/padding/chevron as one action and independent More.
- Branding/native theme: density dimensions/hashes/centering, cold/warm release
  launch, native loading frame, manual/Automatic, captured pair across arrivals
  and unlock, generic pre-unlock notifications and actual OEM accent rendering.
- Recents: affected OEM/launcher and installed-build identity; Agenda, Settings
  and a minimal page; keyboard/sheet/alarm state. Collect scoped private capture
  and Perfetto/system rendering evidence distinguishing app main/RenderThread,
  launcher, SystemUI and SurfaceFlinger. Inspect activity/task/modal/snapshot
  lifecycle. Choose a code change or supported workaround only from that evidence.
  Repeat the same dismissal and confirm native alarm eligibility afterward.

No connected target means that reproduction/trace and physical results stay
pending; it is not evidence of a platform cause or successful fix.
