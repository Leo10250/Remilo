# Implementation backlog (single status source)

Statuses: pending, in progress, implemented/unverified, verified, blocked.
Verified always links actual evidence. Implementation is not a passed release gate.
Owner instruction, 4 October 2026: complete offline Android development now and
consolidate physical checks for a later acceptance run. Pending G1/G2/G3 observations
block verified release, rather than development. Known failures still require fixes.

| ID | Task | Dependency | Status | Acceptance/evidence |
|---|---|---|---|---|
| P0-01 | Expo 57 scaffold, pinned Node/JDK and tracked native project | none | verified | [clean CI, signed offline installation](evidence/2026-10-04-native-slice.md) |
| P0-02 | AI instructions, contracts, backlog, verification scripts/CI | P0-01 | verified | [shared/native commands and clean GitHub verification](evidence/2026-10-04-native-slice.md) |
| G0 | Foundation release gate | P0-01/02 | verified | [clean checkout and signed bundled UI offline on Pixel](evidence/2026-10-04-native-slice.md) |
| P1-01 | Native persistence, asynchronous bridge, recovery records | P0-01 | implemented/unverified | [Room recovery tests pass; remaining physical crash boundaries](evidence/2026-10-04-native-slice.md) |
| P1-02 | Independent alarm, receiver, FGS, audio, Stop/Snooze | P1-01 | implemented/unverified | [cold/locked delivery, cutoff and actions observed; remaining independent/recovery matrix](evidence/2026-10-04-native-slice.md) |
| P1-03 | Cutoff, Direct Boot, recovery and lifecycle verification | P1-02 | implemented/unverified | [reboot fix and owner confirmations; remaining consolidated matrix](evidence/2026-10-04-native-slice.md) |
| P1-04 | Preserve usable notification controls on Snooze re-trigger | P1-02 | verified | [owner confirmed initial/re-triggered buttons; second Snooze registered and final native Stop logged](evidence/2026-10-04-native-slice.md) |
| P1-05 | Structured native command validation | P1-01 | verified | [invalid fields/generations leave data and registration unchanged; shared/native checks pass](evidence/2026-10-04-native-slice.md) |
| P1-06 | Persisted interruption tests and installed-build evidence | P1-01, P0-02 | verified | [20 native tests; preflight distinguishes installed APK from local build](evidence/2026-10-04-native-slice.md) |
| G1 | Native alarm reliability gate | P1-01/02/03/04/05/06, G0 | pending | signed physical tests; failures block wider beta |
| P2-01 | One-off create/detail/views, readiness and timing controls | P1 implementation; physical acceptance deferred | implemented/unverified | [shared/native checks; signed UI acceptance deferred](evidence/2026-10-04-one-off.md) |
| P2-02 | Done/Postpone/post-timeout actions and session grouping | P1 implementation; physical acceptance deferred | implemented/unverified | [action/generation tests; collisions/audio acceptance deferred](evidence/2026-10-04-one-off.md) |
| P2-03 | Settings, diagnostics, export/restore, upgrade safety | P2-01/02 | implemented/unverified | [restore conflicts and both v1→v2 migrations pass; physical transfer/file checks deferred](evidence/2026-10-04-one-off.md) |
| G2 | Complete one-off private beta | P2-01/02/03 | pending | all one-off scenarios pass |
| P3-01 | Pure Kotlin recurrence kernel and portable fixtures | P2 implementation; physical acceptance deferred | implemented/unverified | [fixtures/count/gap/fold/travel checks; physical acceptance pending](evidence/2026-10-04-offline.md) |
| P3-02 | Exceptions, series edits and protected replenishment | P3-01 | implemented/unverified | [protected replenishment, pause/split/restore and interruption tests](evidence/2026-10-04-offline.md) |
| P3-03 | Original accessible polish, management and history | P3-01/02 | implemented/unverified | [shared checks; device usability/accessibility deferred](evidence/2026-10-04-offline.md) |
| G3 | Complete Android reminder product | P3-01/02/03 | pending | physical recurrence and tested OS matrix |
| UX-01 | Tokens/icons, unified agenda queries, search/filter, Completed and Trash | P3-01/02 | implemented/unverified | [host query tests and narrow fixture review; physical usability pending](evidence/2026-10-04-redesign.md) |
| UX-02 | One-off/repeat editor, details, scope selection and Activity | UX-01 | implemented/unverified | [shared checks and fixture review; native picker/Back/keyboard acceptance pending](evidence/2026-10-04-redesign.md) |
| UX-03 | Categorized automatic preferences, inline permissions, Test alarm | UX-01 | implemented/unverified | [sequencing/retry/contrast tests; phone persistence and permission-return checks pending](evidence/2026-10-04-redesign.md) |
| UX-04 | Native controls/snapshot dismissal, notifications, launcher/splash identity | UX-01 | implemented/unverified | [session/Direct Boot/notification tests; signed physical actions and icon masks pending](evidence/2026-10-04-redesign.md) |
| UX-05 | Signed 0.4.0, consolidated checklist and release evidence | UX-01/02/03/04 | implemented/unverified | [shared/native verification and signing; owner U/A–E observations pending](evidence/2026-10-04-redesign.md) |
| TK-01 | Shared tool selection, stable build receipts and release serialization | P0-02 | verified | [host fixtures, doctor and signed ARM64/x86-64 assembly](evidence/2026-10-05-workflow-kit.md); no application/version changes |
| TK-02 | Safe ABI-aware deployment and reusable device preflight | TK-01 | verified | [host fixtures, blocked/successful dry-run and mismatch preflight](evidence/2026-10-05-workflow-kit.md); [owner deployment and installed hash confirmed after randomized-path fix](evidence/2026-10-05-phone-deployment.md) |
| TK-03 | Scoped logs/capture, isolated preview and combined release preparation | TK-01 | verified | [help, scoped process/environment fixtures, HTTP preview and full host preparation](evidence/2026-10-05-workflow-kit.md); real device captures pending |
| TK-04 | Discoverable repo skills and workflow documentation | TK-02/03 | verified | [bundled skill/metadata validation and workflow evidence](evidence/2026-10-05-workflow-kit.md); scripts are the shared procedure |
| DS-01 | Shared Gradle build/inspection without receipts or release locks | TK-01 | verified | [signed ARM64/x86-64 assembly and full host preparation](evidence/2026-10-05-deployment-simplification.md); no Git or receipt prerequisite |
| DS-02 | Sequential one-command deployment with target selection | DS-01 | verified | [35 controlled tooling cases, cancellation and optional launch](evidence/2026-10-05-deployment-simplification.md); simplified real-device deployment smoke remains pending |
| DS-03 | Optional diagnostics, concise skills and current workflow guidance | DS-01/02 | verified | [doctor, discovery/preflight, help, three skill validators and metadata](evidence/2026-10-05-deployment-simplification.md); no new phone mutation |
| P4-A | Optional Google connection and one-off publishing | G3 | pending | explicit opt-in/backfill; retry-safe creation |
| P4-B | Explicit import and protected linked updates | P4-A | pending | unrelated events untouched; visible conflicts |
| P4-C | Recurrence mapping and differential tests | P4-B | pending | standard rules, exceptions and splits |
| P4-D | Incremental/native background opportunities | P4-C | pending | allowlist, pagination, retries, 410 recovery |
| G4 | Calendar release gate | P4-A/B/C/D | pending | both directions after documented sync opportunity |
| P5 | Optional Android cloud/primary-device coordination | G4 | pending | foreground/manual Supabase sync and honest handoff |
| G5 | Android cloud gate | P5 | pending | two Android installations converge |
| P6 | Optional iOS feasibility and complete port | G5 | pending | final phase only; real iPhone capability evidence |

## Task verification contracts

- P0-01: shared checks and bundled Android assembly; clean-checkout CI and signed
  offline installation are separate evidence requirements.
- P0-02: verify commands work from documented toolchains; CI results identify their
  commit. Instructions never claim a manual observation from an automated result.
- P1-01: Room tests exercise create retries, interrupted projections, history replay,
  stale delivery actions, permission-blocked saves and cold recovery. Physical crash
  boundaries remain part of G1.
- P1-02: native policy tests, lint and release assembly; physical cold process,
  permission flow, Stop/Snooze and independent registrations require device evidence.
- P1-03: all G1 procedures in verification.md, with durations and human observations.
  Missing observations remain pending under the owner's deferred acceptance run;
  known failures must be fixed before claiming reliability.
- P1-04: publish complete native controls before service promotion; test the actual
  first and re-triggered notification, old-action rejection and generic pre-unlock
  text. Verify Stop/Snooze on the signed phone build after a ten-minute Snooze.
- P1-05: native command errors identify the field without exposing private values;
  invalid commands leave content, operational generations and OS registration
  unchanged. Native authority validates independently of JavaScript form checks.
- P1-06: seed committed storage boundaries, restart the engine and verify recovery
  without duplicate definitions/history or revived stopped generations. These are
  host tests, not injected physical crashes. Device preflight records available
  local and installed APK hashes separately without source attribution. Missing
  or mismatched artifacts are diagnostics; transport/inspection errors fail.
  Preflight never changes the installed app or declares physical observations.
- Later task groups are split into bounded work units when activated. Each new row
  must include purpose/scope, dependencies, behavior, required checks and evidence;
  place its status only in this backlog.
- UX-01: verify grouping before pagination, deterministic ties, full counts and
  overdue/postponement independence. Inspect 360×800 populated layout and complete U1–U4.
- UX-02: preserve timing/rules and Save-only mutations; no lost drafts or raw engine
  wording. Verify native date/time selection, Back/sheets, validation and all scopes (U5/U6).
- UX-03: test coalescing, refreshed revisions, rollback, lost acknowledgement/read,
  stale revisions and subscription teardown. Phone checks U7/U8 remain distinct.
- UX-04: test initial/loading and refresh/session races, final versus partial actions,
  old Stop all and generic pre-unlock snapshots. U9/U10/U12 recheck real presentation.
- UX-05: pass shared/native/lint/signed assembly, record source/hash/signer, and keep
  unobserved physical/200%-font/TalkBack scenarios pending in the single owner checklist.
- TK-01–04 record the original toolkit contracts and evidence. Their receipt,
  serialization and deployment-preflight details are superseded by DS-01–03.
- TK-01: select/report pinned tools, detect configuration conflicts, attribute only
  stable build inputs and serialize assembly/inspection/install. Require actual APK
  inspection, hash and signer; controlled cancellation must not imply success.
- TK-02: verify explicit/env/single-target precedence, unauthorized/offline/ambiguous
  failures, API/ABI eligibility, safe in-place arguments and default no-launch.
  Accept Android randomized APK directories while rejecting unsupported/split paths.
  Failed post-install verification stays separate from successful installation.
  Use read-only local dry-run; do not initiate phone installation/alarm testing.
- TK-03: scoped tag logs without clearing, binary capture, child-only preview vars,
  and signed release preparation without installation/publication. Verify help and
  controlled process fixtures, then shared/native checks. Real capture/live-log and
  emulator deployment results are distinct from host fixtures.
- TK-04: validate three scoped skills with the bundled validator, keep procedures
  in scripts, and document actual host evidence. No global skill installation.
- DS-01: remove receipt, fingerprint and lock prerequisites from active build
  callers. Reuse the committed Gradle wrapper and existing signing identity; inspect
  actual APK output and retain compatible ARM64/x86-64 assembly. Run shared/native
  verification without changing the application version or behavior.
- DS-02: expose only `--device SERIAL`, `--launch` and `--help`; automatic target
  selection requires one listed authorized transport. Fail prerequisites, API/ABI
  and artifact validation before installation. Use the selected serial with
  `install -r --user 0`; leave UI closed by default. Tests cover cancellation,
  install failure, separate launch failure, paths with spaces and preview isolation.
  Missing receipts and unavailable Git metadata must not block deployment.
- DS-03: keep doctor/devices/logs/capture/preview/preflight/release preparation
  optional. Preflight diagnoses available APK hashes without source attribution.
  Validate three concise skills and document one release-producing workflow per
  checkout. Preserve historical evidence for TK-01–04 rather than rewriting it.

## Simplified deployment owner smoke (pending)

Once host verification is recorded for DS-01–03, connect and authorize one test
device, then run `npm run deploy` from the repository root. Confirm installation
succeeds and Remilo stays closed. Open it yourself and confirm version 0.4.0 and
existing reminders are preserved. For multiple transports, select with `--device`.
This checks the development workflow; remaining alarm/product observations still
use [the consolidated owner checklist](device-acceptance.md). No new alarm-testing
sequence is required by the tooling simplification.

## Later workflow opportunities (outside this kit)

- Synchronized application-version bumping across Expo, npm and Gradle.
- Reproducible icon generation with a pinned Sharp dependency.
- Explicit toolchain download/bootstrap automation, with licensing and integrity checks.

## Host and device prerequisites

- Host Node 22.11 is unsupported; project-local verified Node 22.23.3 is installed
  under ignored .tooling (host installation remains intact).
- Verified portable Temurin JDK 17 and Android SDK/NDK/CMake are installed;
  SDK license acceptance was authorized by the owner. Global installations remain intact.
- A private beta signing identity exists locally; keys/properties are ignored.
- Pixel 9 Pro XL is USB-authorized. The owner's latest instruction defers further
  interactive phone checks to [one consolidated acceptance run](device-acceptance.md).
  Physical verification remains a release dependency, rather than a development gate.
- The owner created origin at https://github.com/Leo10250/Remilo.git and authorized
  pushing completed work. No APK distribution/public release is authorized.
