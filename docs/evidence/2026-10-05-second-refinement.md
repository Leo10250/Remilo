# Second UI refinement and managed Lists evidence

> Implementation evidence at the revision/build recorded below. This report
> preserves observed checks, counts, hashes and limitations; it is not the target
> visual specification. Use [the current design](../design/current/README.md) and
> [TD roadmap](../plans/redesign/README.md) for new UI/theme work. Physical checks
> remain pending unless this report records an actual observation.


The approved second review is implemented across shared presentation, explicit
Browse roots, recorded Activity, recoverable completed cleanup, identified native
sound preview and managed Lists. No alert recurrence recovery no longer creates
false Missed outcomes; recovery repairs existing None/Missed rows without replay.
Overdue still depends on unfinished work and Due. Stop remains distinct from Done.
Implementation commit: `751527a`, based on `e06c978`.

## Host checks — 5 October 2026

- `npm run verify` (pinned local Node/script entry point) exited 0: TypeScript,
  ESLint, **62 domain tests in 11 files** and **35 controlled tooling tests** passed.
- `npm run verify:android` exited 0: **96 native tests in 10 suites**, module debug
  lint, app release lint and signed ARM64 assembly passed. Lint had zero errors,
  7 module warnings and 26 app warnings. Existing Gradle deprecation, unchecked
  casts and SDK XML compatibility warnings were nonfatal.
- Final shared verification followed the last detail refinement. A subsequent
  `npm run build:beta` completed in 52 seconds and bundled that source with the
  existing local signing identity. Build timestamp: 5 October 2026, 8:51 PM PDT
  (`2026-10-06T03:51:03.999Z`).
- Artifact: `com.remilo.app`, **0.4.0 / versionCode 4**, API 34 minimum / 36 target,
  `arm64-v8a`, non-debuggable, signed and bundled, at
  `android/app/build/outputs/apk/release/app-release.apk`.
- Final APK SHA-256:
  `7C61D006CC6A78E9DBAA8CC82CDC212B5BFAFD83837B54AEC25C201A7B4249F6`.
- Signer SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- `git diff --check` passed. Host logs and synthetic screenshots remain under
  ignored `verification/local/`; no APK, signing key or private diagnostics are tracked.

An initial native pass exposed preview replacement races; the release barrier was
corrected and all seven preview-controller tests passed in final native verification.
Sandboxed Vitest runs encountered isolated temporary-file ENOENT failures. The
final complete shared run outside that filesystem isolation passed without changing
or weakening tests.

## Regression coverage and storage boundaries

Presentation covers ordinary/independent coincident values, linked offsets, DST
all-day boundaries, cross-year ranges, adjusted and unknown-reason targets,
intended blocked/changing targets, modes, terminal states, consequential zones,
recorded completion time and command eligibility. Root tests distinguish historical
state, explicit null membership and imported identity `none` from No list.

Native coverage exercises No alert recovery and retained history/overdue membership,
Alert problems before pagination, completed/skipped Trash restoration and stale Undo,
CE upgrades to schema 4, exact legacy case variants, empty lists, removed references,
archived templates and independently adjusted occurrences. Rename/remove preserve
operational targets and generations. Backup tests exercise v1/v2/v3, template
membership, unknown references, local-ID preservation, restored-name suffixes and
retry stability. Family projections carry each slot's own zone, mode and state.

Content schema advances **3→4**; operational schema remains **3**. List names,
identities and membership remain credential-protected. Backup format advances
**2→3** with older readers retained, empty lists and validated membership references.
One-off Trash stays outside export; recurring deletion exclusions remain portable.

Native preview tests use controlled audio handles to exercise Starting/Playing,
actual-tone metadata, failure/interruption, cutoff outcomes, explicit stop, late
callbacks, rapid triple replacement and real-alarm release priority. These test
state/ownership, not physical MediaPlayer playback, focus, fallback or audibility.
The real alarm's five-minute deadline and first-member sound remain unchanged.

## Synthetic fixture review

The opt-in web fixture was inspected in the in-app browser at an initial measured
**360×800 CSS viewport**. Later browser scaling measured **300×667**; captures and
claims reflect those actual dimensions. Light Agenda/detail and dark Settings were
inspected, with wrapping controls and semantic title/status hierarchy.

Interaction checks confirmed current-root dismissal, Browse groups and overdue
occurrence labels, explicit empty-list creation and retention, list-origin Save
with acknowledgement/View, scoped Completed, the direct Reopen control, completed Trash without
a modal, and Undo preserving completion. Detail → More → Activity rendered recorded
events newest-first; Back returned through detail and scoped history to the list.
Stopped-overdue detail exposed Still unfinished, no next alert, Done and Postpone.
The shared sound picker kept selection separate from Play and honestly reported
that this synthetic fixture does not play audio. Backup exclusion text is visible.

The fixture exposed an unsupported root POP_TO_TOP dispatch; root switching now
checks whether a stack can dismiss before doing so. No new instance of that warning
occurred in subsequent root/list Save checks. Browser animation/pointer warnings
and inherited browser scaling are not native acceptance evidence. The temporary
tab and preview server were closed; preview variables stayed in the child process.

## Remaining acceptance

No installation, launch, phone data mutation, permission change or distribution
occurred. Actual Android Back/keyboard ordering, native gesture reveal, lifecycle
audio stopping, focus/fallback/real-alarm priority, migration on the existing phone,
TalkBack, 200% text, reduced motion and native timezone/DST pickers remain pending.
Use [the consolidated owner checklist](../device-acceptance.md), including U17–U20,
with this identified signed artifact. Existing G1–G3 physical gates remain separate.
No complete lifecycle/field-diff history, ringtone catalog, automatic Trash expiry,
permanent deletion, bulk cleanup or whole-family deletion was added.
