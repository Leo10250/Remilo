# Calendar publication and quick local deletion

The owner reported creating a reminder/event, quickly deleting it, and seeing a
remaining Calendar review item with `UNCONFIRMED_RESOURCE`. Check publication
result appeared to do nothing. The source baseline was `b336a9a`; this does not
attribute the installed phone APK to that revision. No live Google event or phone
state was changed during this repair. Task status belongs in the backlog.

## Diagnosis and changes

Local Delete already calls the managed terminal/removal path, retiring its export
and resolving its review. However, Calendar I/O yields to local actions. A
publication callback could subsequently call `publicationFailed` using only the
local ID, overwrite Cancelled with Review, and recreate the issue. The same path
could downgrade a confirmed managed export or affect its replacement operation.

Failures now bind to the captured publication operation, respect terminal states
and check current local eligibility. Retirement atomically suppresses captured
remote identities, including child resources, so a later collection echo cannot
import a removed copy as a new reminder. Startup repairs older export-review
records against saved local terminal/Local only decisions without Google I/O.
Sent operation identity/proof remains available for read-only recovery.

RetryPublication previously acknowledged only its dispatch. The UI discarded the
eventual explanation and showed neither a busy state nor a check outcome. The
bridge now waits for the bounded existing Calendar runner and returns its saved
result. The product shows progress and confirmed/cancelled/still-unconfirmed
feedback, including an explanation that read-only checks do not restore reminders
or change Google. A
confirmed eligible managed publication finishes its link and clears its own
review; acknowledgement-to-link interruption is recoverable by the same identity.
The publication writer and existing authorization/epoch fences remain in use.

Preference reasons now use localized explanations instead of raw internal codes.
The Agenda Review count uses a single localized plural message, fixing the
visible missing space. No schema, backup, scheduling or Calendar-delete behavior
changes. Remilo Trash still does not delete the Google copy.

An unavailable remote lookup remains unconfirmed. Google documents that
[404 may also indicate inaccessible resources](https://developers.google.com/workspace/calendar/api/guides/errors#404_not_found),
so it is not treated as proof of deletion and cannot authorize a new copy.

## Verification record

The focused shared run passed 36 Calendar tests across four files, and TypeScript
passed. The first native attempt stopped during compilation because localization
resources were regenerated while it was running; no native tests ran in that
attempt. With resources stable, 68 native tests in CalendarManagedIntegrationTest
and CalendarPublicationTest passed. A subsequent interruption-recovery case was
added for the full verification run.

The final shared workflow passed 2,126 English/Chinese message pairs, the current
design/preserved-reference audit, TypeScript, ESLint, 313 shared tests in 38 files
and 97 tooling tests. ESLint retains the frozen R8 gallery's existing unused
variable warning; approved scene master-resolution limitations remain recorded
by the design audit. The full native run executed 534 tests across 41 suites,
with zero failures, errors or skips, including the new acknowledgement-to-link
interruption recovery case and local Restore without reauthorization of a
read-only publication. Restored local reminders do not regain an old association
through late confirmation, including older incorrectly revived Review records.

Regression scenarios use synthetic transport data and the real native worker:
deletion during lookup, deletion during sent insert, a lost sent reply, unavailable
read-only identity, repair after restart, successful exact-operation review
recovery, and late errors after confirmed/replaced operations. They check review
counts/pages, local deletion, no extra inserts/patches and no imported replacement.

`release:prepare` passed the repository workflow, including native module/app lint
(zero errors; 27/20 existing warnings) and signed bundled ARM64 assembly. After
the final read-only wording clarification, `npm run verify` passed again and
`npm run build:beta -- --json` successfully reassembled that source. The ignored logs are
`verification/local/calendar-race-release-final.log`,
`verification/local/calendar-race-final-shared.log` and
`verification/local/calendar-race-final-assembly.log`. The final assembly
completed successfully in 2m 36s; no runtime source changed afterward.

Final local artifact, built at `2026-10-17T01:17:21.123Z` (16 October locally):

- Package `com.remilo.app`, version `0.4.0` (4), ARM64; min SDK 34, target 36.
- Bundled JavaScript, not debuggable, signed with the existing beta identity.
- APK: `android/app/build/outputs/apk/release/app-release.apk`, 95,662,539 bytes.
- APK SHA-256: `b656f64fefdf2f05d64574f7508474b1bbcb73180bea5c3b3b7647c61ee38de4`.
- Signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Private combined result: `verification/local/calendar-race-summary.json`.

Post-documentation design verification and `git diff --check` are recorded with
the final handoff. The APK was neither installed nor distributed.

## Device limits

No phone reproduction, new screenshot capture, installation or distribution was
performed. The [CAL-07 signed-phone follow-up](../device-acceptance.md#publication-and-quick-trash-follow-up-cal-07)
retains fast deletion, older-data repair, actual network/lost replies, Back,
TalkBack, both languages and ordinary alarm observations. Host tests and assembly
do not close these live Google/device gates or the existing P4-B–P4-E/G4 gates.
