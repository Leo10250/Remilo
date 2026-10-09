# Native Android slice: 4 October 2026

> Implementation evidence at the revision/build recorded below. This report
> preserves observed checks, counts, hashes and limitations; it is not the target
> visual specification. Use [the current design](../design/current/README.md) and
> [TD roadmap](../plans/redesign/README.md) for new UI/theme work. Physical checks
> remain pending unless this report records an actual observation.


This report separates executed checks, human observations and remaining work.
Task and release-gate status lives only in ../backlog.md.

## Builds and environment

- Physical device: Pixel 9 Pro XL, Android 17 / API 37, security patch 2026-09-05.
- Minimum API 34; compile/target API 36. Release builds contain bundled JavaScript.
- Original source: `db5b9948e4cb52c825fd30b8bcea8981fe0da794`.
  Signed APK SHA-256: `0880163d26b77f07510c920e77c298d47f09d83ac5f03c3ab99d7b45e2ead217`.
- Direct Boot correction: `9ea16d1cb1a4fe20dcab89195cf995de2274172e`.
  Signed APK SHA-256: `939407ae9fee2ac09be7c2438ce4965764bbce4a66637123a90361407dc94380`.
- Notification correction: source commit `6f862d0`.
  Signed APK SHA-256: `7ec6ef32640588cc16ad66447dd8356520f9a7f593eb2fca380470e5358a694e`.
  In-place installation succeeded. Fifteen native tests, lint and release assembly
  passed locally. The owner confirmed that both Stop and Snooze appear on initial
  and snoozed alarms. The phone completed two ten-minute Snooze cycles, with native
  Stop recorded after the second re-trigger; details are below.
- Structured input correction: source `50af86b271a5af910dff7030ca46eb0f96481acd`.
  Built APK SHA-256: `4887f5026f15a06e925580dc0f82fe0ee4d290017c845681348053901c3b9db1`.
  Seventeen native tests, lint/release assembly and twelve shared tests passed.
  This APK has not replaced the phone's notification-test build during its cycle.
- The same local private signing identity was used for in-place updates. Its keys
  and properties remain ignored and were not sent to GitHub.
- Node 22.23.3, Temurin 17.0.20.1+1, committed Gradle wrapper and npm lockfile.
  Room tests run through Robolectric API 34 and do not establish physical behavior.

## Executed foundation checks

- Local TypeScript, ESLint and 12 shared tests passed.
- Additional persisted-boundary tests passed in revision `c93f58d`: 16 Room/engine
  tests plus 4 policy tests, zero failures. They cover a committed definition before
  operational projection, a committed Stop before cancellation/history copying,
  and history copied before acknowledgement. Fixtures seed those persisted states
  and restart the engine; they do not inject crashes into the physical release.
- Updated device preflight successfully read the installed release hash and
  distinguished it from the newer local APK. It returned a deliberate mismatch
  failure and left all physical observations pending. It did not change the phone.
- Local native verification on the Direct Boot correction passed: 4 policy tests,
  10 Room/engine tests, native/app lint and bundled release assembly. Lint had no
  errors; upstream/version/KTX warnings remain.
- [Clean Linux checkout verification](https://github.com/Leo10250/Remilo/actions/runs/37240316121)
  passed for `9ea16d1`: shared checks, native tests, lint and unsigned release assembly.
- [Notification correction clean verification](https://github.com/Leo10250/Remilo/actions/runs/37246049719)
  passed for `6f862d0`, including the native notification regression test.
- The signed release installed on the primary Android user and opened the product
  UI offline without Metro. No development server or OTA update was used.
- Exact-alarm and notification permissions were granted using Remilo's buttons and
  Android's real settings/dialogs. Readiness reported exact access, notifications
  and full-screen-intent access enabled afterward.

## Executed phone scenarios

| Scenario | Evidence and outcome |
|---|---|
| Offline, UI closed, ordinary cold process, locked/screen off | First test process was absent before delivery. A new native process started, logged native-only application startup and an Active session, and ran the systemExempted foreground service. The owner confirmed hearing the tone and seeing the native alarm screen. |
| Five-minute cutoff in screen-off forced idle | Original build: start elapsed `796854408`, deadline `797154408`, playback stopped at `797154412` with reason TimedOut. Duration 300,004 ms; service then absent. The owner initially was uncertain about audibility at cutoff, and later explicitly confirmed the five-minute timeout works. |
| Native Stop | Native-screen Stop ended playback and the service. Ended screen explicitly kept the reminder unfinished. Owner confirmed the sound stopped. |
| Native notification Snooze | Notification Snooze ended playback and registered a new exact alarm at 15:33:54.907, ten minutes after the action. Owner later confirmed the button re-triggered an alarm after ten minutes. |
| Reboot before first unlock | Original scheduler failed registration because default launcher lookup hid the credential-protected activity. Corrected source uses both Direct Boot match flags when constructing the show handle. |
| Repeated reboot with correction | Android reported RUNNING_LOCKED before delivery. At 15:33:55.302 the native session became Active and native AlarmActivity was created. Foreground service had alarm audio and a silent notification channel. Owner explicitly confirmed locked-screen triggering after reboot. |
| In-place signed update | Installing while locked timed out in Android's package verification. Installing after unlock succeeded and preserved the snoozed target. Security verification was not disabled. |
| Re-triggered notification controls | Owner reported missing Stop/Snooze in the popup after Snooze. Source review found an actionless initial foreground notification, followed by an asynchronous replacement. The correction supplies complete controls before foreground promotion. A regression test exercises first/re-triggered actions and rejects the obsolete Stop generation. On the corrected phone build, the owner confirmed both buttons appear on initial and snoozed alarms. |
| Successive native Snoozes and final Stop | The first Snooze registered 17:19:02.349; the second registered 17:29:05.816. The second re-trigger became Active at 17:29:06.018 and its foreground notification contained two actions with no competing notification sound. Native playback stopped at 17:29:20.630 with reason Stopped, and the service was absent afterward. Final audible-stop confirmation is requested separately. |

On 4 October, the owner explicitly confirmed: five-minute timeout, alarm after
reboot, locked/screen-off triggering, Stop, and ten-minute Snooze re-triggering.
These are human observations on the installed release, not results inferred from
host tests. The generic pre-unlock text still needs a recorded visual observation;
the first pre-unlock UI dump used unavailable external storage and did not prove it.

## Limitations and remaining checks

- The owner confirmed initial/re-triggered Stop/Snooze visibility. Their reply did
  not separately enumerate compact versus expanded rendering. Final audible Stop
  confirmation after the second Snooze is requested; native termination is logged.
- Finish physical independent-alarm failure and interrupted-session recovery,
  stale actions, permission revocation/denial, pre-unlock actions and generic text.
- Calls/focus/volume/Bluetooth, Active Apps Stop and force-stop are distinct cases
  still requiring observations. Pixel results do not establish other manufacturers.
- Crash-boundary and stale-state coverage from Room tests is useful but does not
  replace the required physical cases. No broader beta gate is inferred here.
- npm audit reports 27 dependency advisories (8 moderate, 19 high) in the locked
  SDK dependency tree. The Router URI-decoder advisory is patched and regression
  tested; remaining advisories need continued upstream/reachability review. No
  incompatible SDK downgrade or blanket claim of production safety was made.
- No complete one-off management UI, recurrence, export/restore, Calendar, cloud
  or iOS implementation is claimed by this native proof.

Temporary airplane/power/idle settings were restored. A later attempted idle
mutation was not executed because automatic approval review hit an account limit.
At continuation, the phone reported USB power, normal active idle state and
airplane mode disabled. Private raw logs, UI dumps, signing material and device
identifiers remain outside tracked evidence.

The owner subsequently asked to complete implementation before further interactive
phone tests. No recovery probe was saved in the attempted UI automation, and no
Remilo alarms were left armed. Temporary stay-awake and screen-timeout changes
were restored to their captured originals; task-owned UI files were removed.
The remaining physical cases will be consolidated for a later acceptance run.
