# Routine editor, Focus and widget correction evidence — 15–16 October 2026

## Scope and source

This record covers the owner's routine UI correction on `event-routines`, based
on `a4bee84` with the current implementation changes in the working tree. It
extends the earlier [weekly routine](2026-10-15-weekly-routines.md) and
[home-screen widget](2026-10-15-home-screen-widget.md) evidence. Those records
remain observations of their earlier source; their editor wording, schema and
artwork statements do not describe this correction.

Current requirements are the [weekly routine design](../design/current/weekly-routines.md),
[widget design](../design/current/home-screen-widget.md),
[shared visual language](../design/current/visual-language.md),
[product contract](../product.md#android-weekly-routines) and
[native architecture](../architecture.md#routine-alarm-delivery-and-reversible-progress).
The current app's shared components, tokens and active assets govern presentation.
Historical mockup pixels are not implementation authority. Task status belongs
only in [backlog](../backlog.md).

## Current implementation contract

One reminder editor and one persistent Save handle ordinary reminders and weekly
routines. New drafts can change Type; existing records and duplication retain
their type. Type changes preserve shared Title, time, Alert, List and Notes, while
caching type-specific unsaved fields. Direct routine creation defaults to
Notification. The shared inline Alert control exposes Alarm / Notification /
No alert with the existing vocabulary and sound/vibration behavior. The ambiguous
Routine attachment, Today only tile and Use this day action are removed.

Exercises by day presents all seven connected weekday rows. Scoped day/exercise
drafts apply with Done to the parent draft; only parent Save writes native state.
Rest day is explicit. Switching a day to Rest retains its exercises in the
unsaved parent cache, so reopening it and choosing Workout day restores them;
the saved Rest definition contains no exercises. Authored targets and Notes are
preserved. Future-only edits retain today's definition and progress.

Agenda has an informational progress bar plus numeric/spoken exercise count,
without a whole-routine checkbox or generic swipe completion. Focus uses the
current atmospheric Page/header and opaque reading surfaces, then a standalone
exercise card, optional selected illustration, intact authored target, guidance
and Complete & continue / Complete exercise. Named completion feedback and Undo
remain visible after the final exercise. Previous changes the viewed exercise
without undoing it. The compact completed/upcoming sequence and separate Notes
disclosure preserve the current connected-item geometry.

Routine Alarm uses the existing exact-alarm/access/audio path with Start routine,
Snooze and Dismiss alarm. Start confirms dismissal of that alert before opening
its exact dated session after unlock. Dismiss does not complete exercises.
Snooze must remain within the same open date. A mixed ringing session retains
per-member actions; completing/skipping/pausing/deleting/ending a routine detaches
only that member. Ordinary alarm Done, Snooze, overdue and recovery semantics
remain separate. Notification remains quiet by default; a blocked Alarm never
silently becomes Notification.

CE15 stores immutable `(routineId, revision)` plan definitions and exact dated
`versionRevision` references. Notes, Alert/time, sound, vibration and exercises
resolve from the frozen revision. A repeated effective date after clock travel
appends a revision instead of overwriting history. The CE14 migration assigns
legacy revision identities in authored insertion order and binds existing dated
references. DP9 retains content-free alert-action receipts and day-start/end
fences; no titles, Notes, exercise content or progress enter device-protected storage.

A frozen session owns its plan/date across replacement segments. Recovery commits
terminal protected exclusions before exposing a competing replacement rule, so
Direct Boot cannot register another occurrence for an already owned date. Active
Agenda, segment/family upcoming and unfinished-count queries apply these guards
before limits. Untouched future dates remain eligible. Portable format 6 retains
immutable identities and strict snapshot/reference consistency, with readers for
formats 1–5 and deterministic legacy/copy identities. Ended-day corrections never
reopen Agenda or delivery.

The widget consumes the same native progress and guarded exercise commands.
It adds a compact progress bar and matching completion vocabulary. At ordinary
text scale, Undo has reserved width; between 1.2 and 1.6 with an expanded routine,
secondary reminder content yields to full-width stacked completion/Undo. At 1.6+
it uses the summary composition. No widget artwork or second progress authority
was added.

Google/Apple principles and the research limitations are recorded in the current
design contracts. They support readable guidance, low-effort tracking and explicit
reversal; these checks do not establish that cards outperform checklists or that
this feature improves exercise adherence.

## Automated host results

| Command/evidence | Observed result |
|---|---|
| Final `npm run release:prepare` shared phase | Exit 0; 38 shared test files / 310 tests and 97 tooling tests passed; 2,078 English/Chinese messages verified; TypeScript, ESLint and design verification completed; design findings empty. |
| Final Android phase | 40 native XML suites / 511 tests; 0 failures, 0 errors, 0 skipped; module Debug lint, app Release lint and signed Release assembly passed. Gradle completed in 4m 6s. |
| Focused routine/migration/widget suite | 66 tests passed: 42 routine-engine, 18 migration, 6 widget render/lifecycle tests. |
| Sequential `:remilo-alarm:lintDebug` | Passed after the final focused suite; 1m 35s. |

Final release evidence is retained in ignored local files:

- `verification/local/routine-ui-final/release-prepare-final.log`
- `verification/local/release-summary.json` (`ok: true`, prepared at `2026-10-16T07:19:43.865Z`)
- `verification/local/routine-ui-final/apk-artwork-audit.json`

Earlier focused/behavior logs remain available as historical evidence:

- `verification/local/routine-redesign-shared-code-final.log`
- `verification/local/routine-redesign-native-full-final.log`
- `verification/local/routine-final-native-focused-lint.log`

The earlier `routine-redesign-shared-code-final.log` records 309 tests and 2,077
messages at its source revision; the final release run above supersedes that
result for the final implementation. After that earlier run, the UI review gated the correction-history
disclosure on actual correction entries, so an empty disclosure is not shown.
At the 100-exercise limit, a pending removal reserves one slot for Undo; Add
cannot consume that slot, and an English/Chinese hint explains the reservation.
The root agent observed 18 focused JavaScript tests, TypeScript and ESLint pass
for those changes. Final release preparation then passed the full 310-test shared
suite and verified the generated 2,078-message catalog. The standalone full native
run in `routine-redesign-native-full-final.log` also passed 511 tests in 1m 34s;
the final release reran native verification after the generated hint resource.

The existing frozen R8 gallery unused `expectedScreenIds` warning remains, with
no lint error. Gradle retains existing SDK XML/deprecation warnings. No signing
material or private device diagnostics were added. Final release preparation ran
against the completed artwork map and final application/native resources. The
signed APK and its 17 exact packaged illustration exports are identified below.

Native coverage includes routine/ordinary mixed delivery, dedicated receipt-first
Dismiss/Snooze retries and namespace collisions, stale generations/dates,
pre-unlock privacy, uncertain/crashed commands, final-step completion and explicit
Undo, same-day Snooze cutoff, day closure, history correction, pause/delete and
member-only ringing cleanup. Existing ordinary reminder, Calendar, backup and
permanent-deletion tests remain in the full suite.

Additional regressions cover repeated effective dates after backward travel,
frozen metadata/steps, tampered backup-reference rejection, deterministic format 5
revision IDs despite array order, retry-stable copied families, CE14 migration,
and a return to Tuesday through a replacement segment in all three Alert modes.
The latter checks pre-target Agenda/family queries, locked restart/callback,
retention of the original ended session and an untouched future Wednesday.
The exact 21-exercise week remains a test fixture, including Sunday Rest and the
unspecified Friday row weight; it is not installation seed data.

An earlier local release attempt failed an outdated four-action localization
assertion. The corrected test now checks the exact seven action-to-command
bindings in English and Chinese. Initial widget renders also exposed a real
large-text Undo overflow. The final layout and measured tests resolve that
failure; no behavioral assertion was removed to obtain the passing results.

## Observed browser fixture QA

The root agent directly exercised production React Native components through the
isolated, memory-only CUA browser fixture. No durable browser screenshots were
saved. These are observed fixture interactions, not native persistence or device
acceptance:

- English editor at requested 360 and 320 viewport widths showed seven inline days and all three Alert
  modes. A Type round trip preserved shared fields. Scoped day/exercise edits
  and Rest-cache Done/reopen restored exercises as intended.
- Sky/Light English Agenda at requested 360×800 showed an ordinary overdue reminder
  separately from a routine in Today, with visible bar and 1/3 count.
- Focus was reviewed in all eight atmosphere/brightness pairs at Chinese 200%
  and requested 360×800. At Chinese 200%/requested 320×800, completing the last exercise produced 3/3;
  named Undo returned it to 2/3.
- English 100%/requested 320×800 loaded the transparent Front plank with an upper-right
  enlargement affordance. English requested 800×360 used the compact header/View illustration
  fallback; the editor retained its persistent Save footer.

The fixture used a three-exercise sample for the observed counter interaction;
it does not replace the native 21-exercise acceptance fixture. Web `Alert.alert`
is a no-op in this environment, so the review does not verify native discard
confirmation dialogs. Adding static asset imports during the session produced an
HMR unknown-module error. After all 17 promotions, a restarted preview loaded the
shared editor and all 17 illustration choices, accepted an explicit Bench press
selection, and loaded/enlarged the decoded Front plank. The browser error log was
empty on those fresh loads. An ended Thursday retained disabled completion;
Open today selected Friday with its own five-exercise plan. This supports the
stale development-module explanation; final Android packaging is checked separately.
The preview server was stopped and temporary viewport overrides reset.

The final fresh review requested a 360×800 viewport but measured 300×667 CSS
pixels with device-pixel ratio 1.2 in this browser. Earlier dimensions above are
requested viewport settings, not independently measured native dp. Browser sizing
and fixture text-scale overrides do not establish Android device layout acceptance.

## Actual widget composition review

Robolectric native graphics rendered the production Glance composition in all
eight atmosphere/brightness pairs in English and Simplified Chinese. The original
module captures are generated in
`modules/remilo-alarm/android/build/widget-captures/`. To retain the observed
evidence independently of later builds, the 12 action captures and all eight
English atmosphere/brightness captures were copied without regeneration to the
ignored `verification/local/routine-ui-final/widget-actions/` directory.
`verification/local/routine-ui-final/widget-actions/index.json` records each
source path, saved relative path, byte count, source modification time and SHA-256.
All 20 saved files match their source hashes; filenames are unchanged. The
remaining original module captures are build outputs and are not part of that
retained subset.

The final action matrix has 12 captures: English/Chinese × 300×280 at 100% or
300×440 at 150% × Continue/final-completion/Retry, each with Undo. Native assertions
inspect the measured Android TextView layout, full transformed characters, line
ends, ellipsis, line widths, glyph bounds and every clipping ancestor. The Retry
case also requires the exact full Chinese translation `重试同一操作`. The actual
captures were inspected and the action labels/Undo were fully readable.

The existing adaptive, locked, Rest, unavailable and error cases also passed.
The nonpersonal picker preview now contains four internally consistent sample
exercises with 1/4 progress. Static capture collections are not a launcher's real
scrolling adapter. These results do not verify launcher resizing/pinning, native
configuration interaction, TalkBack or OEM background behavior.

## Artwork snapshot and final release fields

All 17 exercise illustrations are approved, promoted and present in the static
Metro map, with their masters and runtime exports retained. The final One-arm
dumbbell row approval binds the owner's 16 October standing approval for existing
and upcoming artwork, including activation, in its
[approval record](../design/production-assets/exercises/one-arm-dumbbell-row-approval-v1.json).
Earlier immutable individual approval records were not rewritten.

The portable audit exited 0 and recorded `approvedVersionsChecked: 17` and
`resourcesChecked: 468`, with empty `findings`, `technicalLimitations` and
`unavailableLocalEvidence` arrays. Its ignored local result is
`verification/local/artwork/exercises/portable-audit-final.json`.
The audit explicitly did not assess runtime contrast or device acceptance.
The [exercise profile](../design/production-assets/exercises/profile-v2.json)
and per-asset approval/provenance records remain authoritative. Unknown IDs retain
text fallback; references are explicitly selected and equipment is never inferred
from an exercise name. Fresh isolated-browser loading and signed APK byte
packaging were verified separately from artwork approval. Signed-phone artwork
contrast, enlargement and usability remain unobserved.

Final artifact and acceptance outcomes:

- Artwork map/masters/exports/provenance: **17 approved versions; portable audit passed**.
- Fresh final asset-load review: **passed in the isolated browser fixture; no error logs**.
- Full shared verification after the last UI corrections: **38 files / 310 tests, 97 tooling tests and 2,078 messages passed**.
- Final `release:prepare`: **exit 0**, recorded in `verification/local/routine-ui-final/release-prepare-final.log` and `verification/local/release-summary.json`.
- Final module Debug lint / app Release lint / signed release assembly: **passed**; Android Gradle workflow **4m 6s**.
- Build source: **working tree based on `a4bee84`** on `event-routines`, including the final UI corrections and all 17 illustration mappings.
- Installation/distribution: **not performed**.
- Consolidated signed-phone task observations: **pending**.

The local artifact is `android/app/build/outputs/apk/release/app-release.apk`:

| Field | Verified value |
|---|---|
| Application / version | `com.remilo.app` / `0.4.0` / version code `4` |
| ABI / SDK | `arm64-v8a`; minimum 34, target 36 |
| Packaging | Signed, non-debuggable, bundled JavaScript |
| APK size | 95,514,735 bytes |
| APK SHA-256 | `8be805975bcb6aada32e8dc77b5aa27f73f7c411ddc8e5f5f3b1e4722e67e554` |
| Signer certificate SHA-256 | `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556` |

The APK artwork audit found all 17 approved WebP exports as exact matching bytes
inside the ZIP, including their packaged resource names. The retained audit is
`verification/local/routine-ui-final/apk-artwork-audit.json`. Its recorded APK hash
and byte count match the artifact above. This establishes inclusion in this
artifact; it does not establish Android rendering, launch or physical acceptance.
After final evidence/backlog updates, `npm run verify:design` exited 0 with no
findings; its log is `verification/local/routine-ui-final/design-final-docs.log`.

## Remaining consolidated physical acceptance

The [device checklist](../device-acceptance.md) and
[verification contract](../verification.md) retain native IME/Back/discard dialogs,
TalkBack and focus announcements, large-text/narrow/landscape and both-language
review, on-device illustration rendering and enlargement, launcher setup/pinning/
reconfiguration/scrolling/restore, offline operation without JavaScript,
permissions/channel overrides, Alarm Start/Snooze/Dismiss and mixed groups,
reboot/first unlock, clock/travel/day rollover and deferred refresh.

Demonstrate leaving Monday unfinished and opening Tuesday without overdue work,
correcting Monday without reactivation, preserving progress/Undo after final
completion and continuing to use ordinary overdue reminders/alarms. Record task
success, errors, assistance and misunderstandings, then refine observed problems.
Host checks, synthetic artwork approval and fixture review do not establish these
physical results, exact-midnight launcher pixels or distribution authorization.
