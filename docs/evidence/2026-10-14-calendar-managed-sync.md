# Managed Google Calendar implementation evidence

This record covers the owner's approved P4-E implementation on
`calendar-automatic-sync`, based on `aa145558a5f70cc3848507da6616f2642255e59f`.
Runtime, bridge, UI and regression source is committed at
`cf7cb2e4af371b8e2ea2d9aa48170a0c4c4cc319`. Later changes to this record,
contracts and backlog are documentation changes. The unrelated owner change to
`.vscode/settings.json` was preserved and is not an application input.

## Recorded implementation

CE 11→12 adds stable installation provenance, managed bindings and policies,
immutable preview/operation receipts, candidate/cache/audit checkpoints, held
publication intent, local disposition and minimal source suppression. DP 6 and
backup 4 remain unchanged. Upgrading grants no managed permission. Fresh initial
recovery of an existing calendar uses No alert; later identities use the reviewed
continuing policy. Creating a new calendar uses its captured ordinary policy.

Discovery uses the saved identity before canonical Remilo name/marker matches,
complete bounded CalendarList pagination and strict secondary/data ownership.
Multiple matches need a choice. Setup exposes a bounded read-only contents sample
without presenting it as the full import count. Connecting/discovery alone cannot
create a calendar or reminder. Creation requests its additional scope only after
confirmed setup, checkpoints the sent phase and returned identity, verifies
CalendarList ownership, and inspects uncertain results without blind POST retries.
Server errors on the non-idempotent creation endpoint remain uncertain.

The shared incremental owner observes enabled empty managed calendars, considers
ongoing/upcoming events locally, preserves initial-cohort defaults and retains
bounded recurring audit progress. Six-read captured-resource verification slices
recheck instance identity/version before local creation; changed exceptions cannot
reuse stale proof. Valid ongoing quiet occurrences and moved future exceptions
survive finite masters without ordinary future slots. Content, links, baseline,
candidate resolution, receipt, Activity and scheduling outbox commit natively.

Genuine local Create/CreateSeries transactions capture publication intent.
Local only applies to a family; imported/restored/materialized/reopened records
and test alarms do not become new export work. Existing publication identities,
per-resource checkpoints and common-baseline ownership remain authoritative.
Exact publication-derived backup collisions retain current work by default;
explicit separate copies receive new identities and remain Local only. There is
no title/time or iCalUID merge.

Pause fences unsent automatic phases and retains logical intent. Resume previews
current source/local values and atomically captures selected ready children;
unselected work stays held. Defaults affect future captures without invalidating
an in-flight creation or changing its initial policy. Separate confirmed manual
operations remain available during Pause. Source unavailability fences that scope
while other calendars continue. Local alarms, completion, Skip, Trash, Unlink and
Purge retain their existing independent authority; late results cannot reactivate
permission or recreate purged private content.

The existing native worker shares page/attempt/time budgets across managed and
linked work, yields between CE commits and checks stopped-work cancellation before
another request/local commit. Quiet review fingerprints, saved mixed-target counts
and Activity remain CE-only. Native projections expose queued work, recovery
counts, observations, successful agreement and failed attempts separately.

The focused commits separate CE storage, discovery/transport, durable permission
state, integrated native phases and bridge/presentation. Shared engine/outbox and
P4-D phase hooks stay together instead of introducing another mutation owner.

## Shared and presentation observations

`npm run verify` passed 257 shared tests in 32 files and 91 tooling tests, plus
typechecking, the design verifier and ESLint. ESLint retained the existing unused
`expectedScreenIds` warning in the preserved R8 gallery; there were no lint errors.
The isolated fixture harness explicitly loads the new memory-only managed adapter
while continuing to reject unexpected dependencies. A first run exposed that
missing dependency registration; it was corrected without removing assertions.

Deterministic native tests cover migration/origin persistence, strict ownership,
creation consent/reply/propagation recovery, immutable request reuse, initial
cohort timing, atomic genuine creation, quiet recurring recovery, moved exceptions,
captured-instance changes/continuations, partial publication and newer dirty edits,
selected Resume with automatic import disabled, other-source independence,
exact backup collisions, privacy, cancellation and quiet mixed review notices.
Existing P4-B/C/D regressions remain included.

[Production-component fixture observations](2026-10-14-calendar-managed-visual.md)
record the actual eight-pair, narrow/landscape, large-text, bilingual and reduced
motion views. Review found and rechecked wrapping of setup/Resume actions at
360 px and corrected incoming/recovered elapsed-alert wording. The 36 screenshots
remain private under `verification/local/p4e-visual-2026-10-14/`. These are browser
fixtures, not Android timing, Google execution or physical accessibility evidence.

## Final Android checks and identified artifact

After shared verification, `npm run verify:android` passed on the final committed
runtime: 423 native tests with no failures or errors, module debug lint, app release
lint and ARM64 release assembly. This includes 85 dedicated managed Calendar tests
across discovery, store, setup runner, recurring audit and 29 engine/transport
integration cases, alongside the retained regressions. Final signed preparation
then ran `npm run build:beta`; it succeeded using the existing beta identity.
The repository design verifier also passed after contract/evidence updates.

Gradle retained its deprecation notice and the existing SDK XML tool-version
warning. These do not constitute a device observation or an alarm reliability
claim. Private complete command logs are retained as
`verification/local/p4e-shared-verification.log`, `p4e-android-verification.log`,
`p4e-beta-build.log` and `p4e-design-verification.log`.

| Artifact fact | Observed value |
|---|---|
| Runtime source | `cf7cb2e4af371b8e2ea2d9aa48170a0c4c4cc319` |
| Package / version | `com.remilo.app` / `0.4.0` (`4`) |
| Variant / ABI | Release / `arm64-v8a` |
| Minimum / target SDK | `34` / `36` |
| Packaged application | Bundled JavaScript, not debuggable, signed |
| Retained APK | `verification/local/p4e-remilo-0.4.0-cf7cb2e-arm64.apk` |
| Size | `87,534,075` bytes |
| APK SHA-256 | `49179c0c570ee0afd5235b55c3ed0d21aee565bb02dd0f612c9ca927f02f6013` |
| Signer SHA-256 | `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556` |
| Preparation timestamp | `2026-10-14T22:21:51.831Z` |

The retained copy and the inspected Gradle output have equal SHA-256 hashes.
`verification/local/p4e-release-summary.json` records the source relationship,
checks and inspected metadata. Signing material and APKs remain ignored local
files. The build consumed runtime paths equal to the stated commit; documentation
and unrelated editor settings do not establish a different executable source.
No reproducible-build or installed-artifact match is inferred from this record.

## Observation boundaries

No phone installation, distribution, Google authorization or live Google mutation
was performed for this evidence. The [consolidated owner checklist](../device-acceptance.md)
retains discovery/reuse/creation, both directions, quiet recovery, recurrence,
paused queues, offline/revoked-access/conditional recovery, independent deletion,
review notification and Android accessibility observations for the identified
signed build. P4-D's prior signed-device gaps are retained. Host tests and browser
fixtures cannot close those observations or G4.

Recovery does not reconstruct completion, Snooze, independent local timing, sound,
lists or local history from Google. Legacy source-less imported backups may not
be reconciled automatically. There is no primary-device election, cross-device
completion synchronization, automatic history backfill or global exactly-once
calendar creation promise.
