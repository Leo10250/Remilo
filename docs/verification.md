# Verification and release evidence

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

### Appearance design review

The [P01-P12 plans](plans/redesign/README.md) define the staged gates. The owner
authorizes P01 execution through A10. P01 first audits reference/current output,
obtains style-brief approval, and requires actual representative Agenda/full-Meadow Water plants alarm renders,
side-by-side original/current/corrected comparisons, composited accessibility checks
and explicit style/screen approval before any theme expansion. Existing A/B/C
facilities below are preserved tooling, not a passed gate or required broad expansion.
See [baseline limitations](evidence/2026-10-06-redesign-reassessment.md) and
[approval ledger](design/approvals.md). P12 extends the existing single owner phone
checklist rather than creating another physical-status source.

`npm run preview:ui` exposes the non-shipping `/design-review` workspace. Compare
A/B/C with the same scenario/brightness/period/content; actions are memory-only.
`?inspect=1&screen=agenda&approach=hybrid&scale=2&brightness=dark&scenario=long-titles`
provides a clean phone-sized inspection view. Real shared controls and draft
helpers are exercised, but picker/keyboard/Back/TalkBack acceptance remains native.
Browser alarm/notification examples are explicitly representations, not Android
notification layout or delivery evidence.

`npm run verify` includes opt-in web/normal Android resolver isolation and palette
role/fixture checks. `node --experimental-strip-types
scripts/verify-design-review-assets.mjs [sharp-package-path]` checks exact Classic
source pixels and native artwork/token parity without writing files.

The debug native `AlarmDesignReviewTest` renders actual `AlarmControlsScreen`
through Robolectric native graphics. `verify:android` runs it with the module's
debug unit tests. Artifacts are under
`modules/remilo-alarm/android/build/outputs/design-review/native`: `index.json`,
`gallery.html` and native PNGs. The gallery opens directly with relative assets.
Assert nonblank pixels, distinct A/B/C treatments, generic content and reachable
captured-member/session actions at 100%/200% text. Confirm the review activity is
non-exported in debug and absent from release. No engine, database or alarm service
is instantiated by those fixtures.

Review the actual rendered text/controls over artwork, all palette choices,
long English/Chinese and desktop/mobile layouts. Check scanning, simple creation,
destination discovery and event/Due/alert versus Stop/Done comprehension. Owner
layout/artwork/token approval precedes broad production changes; host results alone
do not pass that design gate or any physical reliability gate.

- Clean checkout builds with pinned tools and lockfile.
- Locally signed release APK installs, opens offline, and has bundled JS/no Metro.

## G1: physical native alarm proof

| Scenario | Expected |
|---|---|
| Close UI/kill ordinary process, remain offline | native alarm fires without JS |
| Another foreground app | actionable authorized presentation; no forced overlay |
| Locked/screen off | native alarm surface where permitted |
| Reboot, do not unlock | generic delivery and native Stop/Snooze |
| Ignore alarm five minutes; force idle/screen off | cutoff; no automatic repeat |
| Stop | unfinished item, sound ends |
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
4. Open Remilo. A should be Interrupted and unfinished; B should be Stopped and
   unfinished. A must not resume sounding. Confirm this across another reopen.

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

G2: Done vs Stop, all postponements after timeout, independent colliding occurrences,
settings, restore preview, upgrade safety, no credential/runtime backup transfer.

G3: rule fixtures, invalid dates/count, DST/travel, edits/skip/pause, preserved
postponement collisions, accessibility and API 34–37 matrix. Another OEM phone is
required before broad manufacturer claims.

G4: scoped Calendar writes, both directions, etag conflicts, retry identity,
cancelled instances, supported recurrence mapping, pagination and 410 recovery.

G5: disconnected changes/convergence, normal and offline primary handoff, logout,
Calendar writer separate from ringing role. G6: real-iPhone behavior, documented
limits, widget/countdown integration and visible coverage. No early iOS testing.

## UX refinement acceptance

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
  native Stop leaving the reminder unfinished.
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

## Second refinement consolidated observations

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
