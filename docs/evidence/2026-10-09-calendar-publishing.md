# Optional Google Calendar publishing — 9 October 2026

## Scope and authority

The owner approved P4-A manual, reviewed publication of saved unfinished one-offs.
Connecting publishes nothing. One account and one default owned calendar are
supported; each reminder retains one publication identity. Imports, recurrence,
linked updates, automatic backfill and background synchronization remain outside
this implementation. The [publishing contract](../calendar-publishing.md) records
privacy, storage, transport, lifecycle and recovery decisions.

The owner supplied development project `remilo-511205`, its Android OAuth client
and the designated **Remilo Reminders** calendar after completing Console setup
manually. The duplicate test-user warning was already resolved. This is
owner-reported setup, not independently inspected Console configuration or
successful Android OAuth evidence. Tester email and exact calendar ID are in
ignored `verification/local/calendar-development.json`; neither is bundled.
No Google authorization or remote Calendar write was performed by the agent.

The [separate owner attestation](2026-10-09-owner-g1-g3-attestation.md) records
G1–G3 acceptance on APK `47fb75e5c6d03f507e7c93e10cebfe33f9fde2db5e4af0a4c31df857717c8a07`.
It does not establish results for the Calendar build. BETA-04 remains open:
the owner reports that the Recents afterimage still reproduces. Unrelated task
verification rows have not changed, and G4 remains pending.

## Implementation

- Plain Kotlin CE state owns connection metadata, immutable jobs and bindings.
  Room migrates 6→7; DP remains 6 and backup remains 4. No token, Calendar content,
  connection metadata or network job enters DP or portable backup.
- AuthorizationClient uses pinned `play-services-auth:22.0.0`, all four approved
  scopes, a non-exported credential activity and stable UserInfo `sub` binding.
  Partial consent and stale callbacks preserve confirmed configuration. Tokens
  remain transient/native; invalid cached access is cleared for reauthorization.
- Owned discovery is paginated and checks every entry. Publication revalidates
  the original destination. Immutable event mapping retains instants, named zone,
  date-only exclusive all-day ends, private/Busy behavior and disabled Calendar
  reminders; independent due/alert/delivery state remains local.
- A canonical versioned tuple produces a stable remote event ID. Exact lookup,
  insert and duplicate/lost-response reconciliation use that identity. Existing
  remote edits are recognized without overwrite; foreign/cancelled identities
  surface conflicts. Network/auth work runs outside the alarm mutation worker.
- Interrupted jobs remain manually recoverable. Default/account changes do not
  retarget them. Trash cancels unsent work; Purge erases captured content and
  display/link metadata, including after late callbacks, while retaining minimal
  identity evidence. Purged recovery can select the original account again and
  still verifies its subject. Disconnect fences requests and reports revocation.
- Settings manages connection, owned destination and durable publication status.
  Details → More opens native-derived review with a persistent Publish action.
  Saved status exposes recovery and the original destination; local event edits
  report differences without remote updates. Ordinary local controls remain usable.

## Host verification

Application source is the Calendar implementation on base `ef8e7ef`, branch
`google-calendar-publishing`, subsequently committed for handoff. Application
source stayed unchanged through the final checks and assembly; later edits only
record documentation and evidence. The repository's `release:prepare -- --json`
ran shared verification followed by Android verification, using existing signing.

- Shared verification completed **10 October 2026 at 06:10:53.678 UTC**
  (9 October local): design/evidence audit, TypeScript, lint, **378 shared tests**
  in 53 files and **82 tooling tests** passed. Lint retains the existing unused
  `expectedScreenIds` warning in the reference gallery generator, with no errors.
- Android verification completed **10 October 2026 at 06:14:43.215 UTC**:
  **216 native tests in 21 suites**, zero failures/errors/skips, module/app lint
  and signed release assembly passed.
- New tests exercise migration preservation, long Unicode notes, DST gap/fold
  mapping, all-day exclusive ends, floating-zone pinning, independent instants,
  ownership/pagination, partial consent, stale previews, account mismatch,
  immutable retries, modeled interruption/lost replies/duplicate IDs, existing
  remote edits/conflicts, local edits, Trash/Purge/late results and revoked access.
  Engine tests check unchanged DP/alarm registrations, backup exclusion and local
  Done progress while a fake transport is blocked. These are host simulations,
  not Google service or physical delivery observations.
- The isolated memory-only fixture is tested without HTTP or native authorization
  capabilities. Its Connect/Publish controls cannot authorize accounts or create
  real events. It supports synthetic consent, unavailable services, pagination,
  offline/lost replies, differences and recoverable/terminal publication states.

## Isolated presentation observations

The publication review was visually inspected at 360×800 in all eight
atmosphere/brightness pairs. Destination, exact content, range, named zone and
privacy guidance remain readable with persistent Publish/Cancel actions. Settings
and the owned-calendar sheet were inspected in Sky Light; loading another page
and selecting its owned destination updated the default and closed the sheet.

Long English/Chinese content was inspected with 200% fixture text at 360×800;
text wraps and grows, and the measured prominent Publish target is 72 px high.
The all-day review was inspected at 320×720 with 200% text and the reduced-motion
fixture setting, showing date-only values and the exclusive-end explanation.
These fixture values are not Android system-font, density or accessibility results.

An offline lost-reply fixture was published deliberately. It showed the saved
Unconfirmed job and Retry same publication, with no replacement Publish action
or stale parent error. Retrying while offline retained that saved status. Further
browser review was interrupted by browser-control timeouts; no additional
Published/difference, native keyboard/Back or accessibility observations are claimed.

## Signed artifact and remaining observations

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, signed and
non-debuggable with bundled JavaScript, ARM64, **com.remilo.app 0.4.0 / code 4**,
minimum SDK 34, target SDK 36. Built **10 October 2026 at 06:14:43.215 UTC**.

APK SHA-256:

```text
0a010b846b21ae67a1b870990cce77dd9867601b4ebe4e3cfd05a961d04666c4
```

Existing signer certificate SHA-256:
`880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
Its registered SHA-1 is in the publishing contract; no signing identity changed.

Private summary/logs are `verification/local/release-summary.json` and
`verification/local/p4-release-accepted.log`. Earlier local preparation passes
preceded the final consent/deletion corrections and are not this artifact's identity.
No installation, launch or APK distribution occurred.

All [signed-device publishing cases](../calendar-publishing.md#signed-device-acceptance-procedure)
remain pending: real OAuth/connect/cancel/reconnect/revocation, owned-calendar
selection, timed/all-day events, suppressed Calendar reminders, offline recovery,
unchanged local alarms and native visual/accessibility/keyboard/Back behavior.
Use only the designated test account/calendar and test reminders. No device model,
OS matrix, observer outcome or remote event result has been inferred.
