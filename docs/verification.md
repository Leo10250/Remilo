# Verification and release evidence

Run npm run verify for shared checks, npm run verify:android for native checks,
npm run verify:device for preflight and a pending observation report, and
npm run build:beta for the locally signed bundled release. All manual observations
start pending; collecting adb output does not prove audible behavior.

Each report records timestamp, Git commit, build variant, APK hash, device/OS,
permissions, scenario, result, measured duration and observer. Store private local
reports in ignored verification/local; commit only explicitly redacted evidence.
The owner's consolidated offline Android run is in [device-acceptance.md](device-acceptance.md).
Use it for one batch of manual results; do not resume repeated unlock/test questions
unless the owner asks. Technical fault/OS coverage remains separate and pending.
Preflight distinguishes workspace revision, local APK hash and installed APK hash.
The current workspace commit is not evidence of the installed build's source.
Associate its hash with the source recorded at build time. A mismatched or unknown
installed APK fails preflight; it never silently installs or changes the phone.

## G0: foundation

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
