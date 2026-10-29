# Separate creation and general routines — 18 October 2026

The approved creation plan is implemented using the current components, four
atmospheres and independent brightness. Agenda/list-content Create opens the
two-choice themed sheet; the library retains direct New routine. Reminder and
routine editors have separate routes and owning drafts. Legacy routine links
redirect, including saved targets discovered through reminder records. An invalid
saved target shows recovery instead of silently creating a blank routine.

New routines are blank General/Shared drafts with no selected days and the existing
Notification default. The optional Exercise preset changes form vocabulary,
examples and illustration disclosure without inserting exercises or modifying
authored content. Shared sequences are materialized using logical shared keys and
independent weekday step IDs. Day off/on caches, explicit source-day conversion,
copying, reordering and duplication retain the specified identity rules. Changing
arrangement requires a selected source when authored content exists only in an
unscheduled draft, protecting that content from silent loss.

The shared form serves nested draft editing and direct row Edit. Direct shared
editing updates linked copies by identity; independent editing updates one day.
Current-day progress still reconciles by stable IDs, checked-step removals receive
review and closed history remains frozen. Captured retries, revision rejection,
image leases, native scheduling and serialized mutation authority remain in use.

CE migration 16→17 adds immutable version authoring/preset metadata. Existing
routines default to ByWeekday/Exercise without inferring shared content. DP stays
at schema 9. Portable format 8 includes metadata/linkage and retains the prepared
archive/media workflow; legacy formats 1–7 remain accepted. Native validation
rejects invalid enums, duplicate/missing links and inconsistent shared sequences
before mutation/import. Existing family conflict, Trash and media behavior remains.

Generic terminology is applied across app, native projection, notifications,
widgets, accessibility and English/Simplified Chinese. Routine navigation uses
日常计划 and General steps use 步骤. Curated widget samples use Morning routine;
Exercise samples retain the existing workout example. Widget composition, Done
feedback, repeated Undo and bottom-aligned controls are unchanged.

## Observations and regression coverage

Actual React Native Web components were rendered in 64 combinations: eight
appearance pairs × English/Chinese × 100%/200% text at 390 dp and 320 dp widths.
Save targets remained at least 56 dp high, within the page gutters, and no page
overflow or browser script errors were observed. Representative light/dark,
Chinese 200%, creation-menu, step-form and conversion-review renders were inspected.
The fixture exercises shared creation, preset/content preservation, one-tap shared
editing, independent Monday/Thursday sequences, copying, conversion/cancellation,
both creation choices, inherited lists, legacy redirects and failed saved loads.
Task scenarios created a weekly water-plants reminder, a shared weekday morning
routine and independent Monday/Thursday Exercise sequences. The in-memory fixture
does not project newly created routine occurrences into Agenda, so the saved
weekday sequence was verified through the library/editor; native projection and
delivery remain covered separately by engine tests and pending phone observations.
Native RemoteViews render tests also cover General examples in all appearance
pairs, both languages and 100%/200% text alongside the retained Exercise fixture.

Builder tests cover blank defaults, explicit identities with duplicate names,
reorder/content changes, unsaved day off/on, saved unscheduling, conversion,
independent copying, duplication, shared direct editing and preset preservation.
Native checks cover metadata/link validation, immediately effective revisions,
frozen snapshots, migration defaults and format-8/legacy-7 backup behavior. The
existing receipt, widget-action, media, Trash, Calendar isolation, recurrence,
overdue and recovery suites also passed.

These host/browser observations do not establish Android IME, TalkBack, native
sheet/keyboard stacking, launcher behavior or physical alarm reliability. The
three creation tasks and device scenarios remain on the
[consolidated owner checklist](../device-acceptance.md#generic-routine-creation-follow-up--18-october-2026).

## Repository checks and artifact

The final `npm run release:prepare -- --json` passed at
`2026-10-18T21:03:14.081Z` (14:03 PDT). Localization verified 2,226 English/Chinese
messages. Design/preserved-reference checks, TypeScript, ESLint, 327 shared tests
in 40 files, 104 tooling tests and 583 native tests in 43 suites passed. Native
reports contain zero failures, errors or skips. ESLint retains the existing frozen
R8 gallery unused-variable warning. Module/app lint has zero errors and 29/20
warnings, unchanged from the previous build. Signed release assembly passed.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), `arm64-v8a`, min/target SDK 34/36, bundled
JavaScript, nondebuggable, 95,873,235 bytes.

- APK SHA-256: `5dab00c69a1487e7dc675176fb22dfeb7364f3cbcb66f275d31b89d6e7fd4481`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained task/artifact/source proof: `verification/local/generic-routines-summary.json`.
- Workflow log: `verification/local/generic-routines-release-final.log`.
- Browser evidence: `verification/local/generic-routine-static-renders/` and
  `verification/local/generic-routine-narrow-renders/`.

The bundled source map was compared with ten changed runtime files, including
both editor routes, the menu, builder, shared form and direct-edit/Focus components;
their source contents matched. Private fixture exports and captures remain ignored.
No installation, distribution or publishing accompanied these checks.
