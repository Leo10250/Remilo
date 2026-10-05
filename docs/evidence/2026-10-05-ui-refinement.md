# UI refinement implementation and host evidence

The approved audit plan is implemented for the offline Android app. Collections,
family-based Repeats, recent-first history, trailing completion and swipe reveal,
compact detail actions, transactional repeat authoring, named-zone timing and
recovery feedback replace the audited UI paths. Stop, Done, Snooze, Postpone and
Trash retain their separate meanings.

## Automated checks — 5 October 2026

- `npm run verify` exited 0: TypeScript, ESLint, **48 tests in 9 domain files**,
  and **35 controlled tooling fixtures** passed.
- `npm run verify:android` exited 0: **78 native tests in 8 suites**, module debug
  lint, app release lint and ARM64 release assembly passed. Lint reports contain
  zero errors, 7 module warnings and 26 app warnings. Gradle deprecation, unchecked
  cast and local SDK XML compatibility warnings were nonfatal.
- The final assembly completed in 57 seconds after the last source refinement.
  It produced `com.remilo.app`, **0.4.0 / versionCode 4**, `arm64-v8a`, signed and
  bundled, at `android/app/build/outputs/apk/release/app-release.apk`.
- APK SHA-256:
  `B1A6F4D69800B762B5BE40F9636D770AEB88797EC65C6C912F676467AD5A6577`.
- `git diff --check` passed. Private host logs remain under ignored
  `verification/local/ui-refinement/`; no key, private diagnostic or APK is tracked.

Native regressions cover civil gap/fold conversion, alias/instant preservation,
23/25-hour day boundaries, date-dependent ICU offsets, read-only query invariants,
split family aggregation and retained exceptions, history timestamps before
pagination, stable ties and historical list discovery. Domain regressions cover
revision-specific Undo, one-off edit routing, acknowledged command outcomes,
three-way conflict review and explicit choices, exact uncertain restore retries,
transactional rule copies and full summaries. Linked due/alert authoring retains
civil offsets across DST; timed event duration remains elapsed.

## Fixture and identity review

The opt-in memory-only web adapter was reviewed in the in-app browser at a requested
360×800 viewport; a later scaled browser view measured 300×667 CSS pixels. Light
agenda/detail screens and dark Settings surfaces were inspected. Interaction checks
confirmed one Save returning creation to Agenda, a View notice, direct one-off Edit,
Custom repeat cancellation preserving the parent draft, explicit completion/Undo,
separate Clear query and Exit search, a confirmed-empty search, Collections, paused
family planned-date wording and Test alarm feedback beside its trigger.

Swipe release revealed a labeled Done button without completing the synthetic
reminder. The web review exposed and corrected an unavailable web animation hook.
The preview remained synthetic: it did not schedule, play audio or touch phone data.
Browser scaling and web animation/pointer warnings are not native acceptance evidence.

The R mark and notification dot were exported from owned vector geometry for
adaptive, monochrome, legacy/round, splash, favicon and notification variants.
Expected dimensions and the 33 dp adaptive safe circle passed; repeated generation
matched SHA-256 for 11 representative outputs. A private synthetic contact sheet
was inspected at enlarged masks and actual 48/24-pixel sizes. Launcher recognition
on a physical phone remains an owner observation.

## Boundaries and next acceptance

Read-only bridge additions use bundled ICU metadata and Java time rules. A derived
repeat rule allows one complete UI summary across rows, details and the editor.
There is no Room or backup migration, new storage authority, Calendar/cloud/iOS work,
notification identity change or audio deadline change. New zone choices use canonical
ICU system IDs supported by Java time; existing valid imported aliases stay unchanged.

No installation, launch, permission change, phone data mutation, distribution or
physical alarm claim occurred. Actual Android Back/keyboard ordering, native picker
zones, TalkBack/focus, 200% text, reduced motion, native ringing and launcher masks
remain for [the consolidated owner acceptance run](../device-acceptance.md), alongside
the existing G1–G3 gates. The test stack has no React Native render/hook harness;
domain tests and fixture interactions do not substitute for those observations.
