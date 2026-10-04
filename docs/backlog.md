# Implementation backlog (single status source)

Statuses: pending, in progress, implemented/unverified, verified, blocked.
Verified always links actual evidence. Implementation is not a passed release gate.

| ID | Task | Dependency | Status | Acceptance/evidence |
|---|---|---|---|---|
| P0-01 | Expo 57 scaffold, pinned Node/JDK and tracked native project | none | implemented/unverified | local release assembly passes; clean CI/phone gate remains |
| P0-02 | AI instructions, contracts, backlog, verification scripts/CI | P0-01 | implemented/unverified | shared verification passes; GitHub CI execution pending |
| G0 | Foundation release gate | P0-01/02 | pending | signed offline APK installed on Pixel, no Metro |
| P1-01 | Native persistence, asynchronous bridge, recovery records | P0-01 | implemented/unverified | eight Room recovery tests pass; physical lifecycle pending |
| P1-02 | Independent alarm, receiver, FGS, audio, Stop/Snooze | P1-01 | implemented/unverified | policy tests/lint/build pass; signed-device verification pending |
| P1-03 | Cutoff, Direct Boot, recovery and lifecycle verification | P1-02 | in progress | physical scenarios in verification.md |
| G1 | Native alarm reliability gate | P1-01/02/03, G0 | pending | signed physical tests; failures block wider beta |
| P2-01 | One-off create/detail/views, readiness and timing controls | G1 | pending | quick creation and clear due/alert separation |
| P2-02 | Done/Postpone/post-timeout actions and session grouping | G1 | pending | two occurrences, one sound, original deadline |
| P2-03 | Settings, diagnostics, export/restore, upgrade safety | P2-01/02 | pending | no stale session/handle replay; safe restore preview |
| G2 | Complete one-off private beta | P2-01/02/03 | pending | all one-off scenarios pass |
| P3-01 | Pure Kotlin recurrence kernel and portable fixtures | G2 | pending | supported rules, gap/fold/count/travel tests |
| P3-02 | Exceptions, series edits and protected replenishment | P3-01 | pending | old postponed items preserved; two future registrations |
| P3-03 | Original accessible polish, management and history | P3-01/02 | pending | everyday Android workflow and accessibility |
| G3 | Complete Android reminder product | P3-01/02/03 | pending | physical recurrence and tested OS matrix |
| P4-A | Optional Google connection and one-off publishing | G3 | pending | explicit opt-in/backfill; retry-safe creation |
| P4-B | Explicit import and protected linked updates | P4-A | pending | unrelated events untouched; visible conflicts |
| P4-C | Recurrence mapping and differential tests | P4-B | pending | standard rules, exceptions and splits |
| P4-D | Incremental/native background opportunities | P4-C | pending | allowlist, pagination, retries, 410 recovery |
| G4 | Calendar release gate | P4-A/B/C/D | pending | both directions after documented sync opportunity |
| P5 | Optional Android cloud/primary-device coordination | G4 | pending | foreground/manual Supabase sync and honest handoff |
| G5 | Android cloud gate | P5 | pending | two Android installations converge |
| P6 | Optional iOS feasibility and complete port | G5 | pending | final phase only; real iPhone capability evidence |

## Current prerequisites

- Host Node 22.11 is unsupported; project-local verified Node 22.23.3 is installed
  under ignored .tooling (host installation remains intact).
- Verified portable Temurin JDK 17 and Android SDK/NDK/CMake are installed;
  SDK license acceptance was authorized by the owner. Global installations remain intact.
- A private beta signing identity exists locally; keys/properties are ignored.
- Pixel 9 Pro XL is USB-authorized. The owner resumed phone testing after initially
  deferring it; physical verification is now the next release dependency.
- The owner created origin at https://github.com/Leo10250/Remilo.git and authorized
  pushing completed work. No APK distribution/public release is authorized.
