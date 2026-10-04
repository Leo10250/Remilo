# Verification and release evidence

Run npm run verify for shared checks, npm run verify:android for native checks,
npm run verify:device for preflight and a pending observation report, and
npm run build:beta for the locally signed bundled release. All manual observations
start pending; collecting adb output does not prove audible behavior.

Each report records timestamp, Git commit, build variant, APK hash, device/OS,
permissions, scenario, result, measured duration and observer. Store private local
reports in ignored verification/local; commit only explicitly redacted evidence.

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
| Fail processing earlier independent alarm | later alarm remains registered |
| Crash at persistence/registration/action boundaries | idempotent recovery, no cancelled replay |
| Kill process during ring, reopen/reboot | interrupted session remains silent |
| Grant/revoke exact permission | cancelled/blocked status and reconciliation |
| Deny notifications/full-screen | honest controls/presentation capability |
| Calls/focus/volume/Bluetooth | original deadline and honest audio outcome |

Active Apps Stop and force-stop are separate expected-limitation scenarios.
Force-stop does not prove ordinary cold-process failure. Private Space restrictions
are documented, not guessed from app readiness. An emulator never verifies audibility.

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
