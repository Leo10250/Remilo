# Day tabs and structured targets — 18 October 2026

The routine editor uses independent weekday drafts, Monday-first tabs, compact
regular/empty states, direct step editing, Date and time, collapsed More settings
and persistent Save routine. Nonempty days determine scheduling. General and
Notification remain the blank-draft defaults; no authored examples are inserted.
The approved HTML references informed composition, while actual production
components provide the captured UI.

Exercise targets have optional numeric sets/reps/time, ranges, each-side scope,
weight and additional text. Numeric strings remain local through incomplete entry;
native validation owns submitted values. RN/Kotlin share localized summary fixtures,
including both reps/time, singular counts and small decimals. Existing custom text
is never parsed. Explicit representation replacement and cancellation retain the
cached draft. General edits preserve structured values unless target text changes.

Copying captures source/destinations, reviews populated replacements and allocates
fresh independent IDs only when applied. Source IDs, immutable photo references,
removal Undo, capacity reservations and draft leases remain intact. Step Done,
copying and timing Done affect the parent draft; only parent Save persists.

Existing Shared plans convert on Save with a scope notice. Materialized IDs and
matching checks survive, and direct row Save changes only its captured weekday.
Opening/cancelling does not alter saved linkage. Captured operations, revision
conflicts, concurrent completion, midnight and closed history retain native ownership.
The owning draft holds its loaded plan revision until explicit Reload.

CE17/DP9 are unchanged. Portable format9 carries optional target JSON in versions
and snapshots, while formats1–8 retain authored text and historical Shared metadata.
Commands/imports use the same native target validator. Invalid target data rejects
before mutation, and existing archive/photo/Trash/history and family-copy checks run.

## Observed checks

Final `npm run release:prepare -- --json` passed at
`2026-10-19T04:04:21.396Z` (21:04 PDT on 18 October).

- Localization verified 2,303 English/Chinese messages. A generator regression
  guard rejects mismatched native plural resource types between languages.
- Design/preserved-reference checks, TypeScript and ESLint passed. The existing
  frozen R8 gallery unused-variable warning and previously recorded approved-master
  resolution limitations remain; no frozen assets were modified.
- 333 shared tests in 41 files and 105 tooling tests passed.
- 589 native tests in 44 suites passed, with zero failures, errors or skips.
  Module/app lint reported zero errors and 29/20 warnings respectively.
- 160 actual component captures cover eight atmosphere/brightness pairs × two
  languages × 390 dp/100% and 320 dp/200% presentations × five states: empty routine,
  regular day, empty day, both numeric targets and populated copy replacement.
  Control bounds and tab counts passed with no browser script errors.
- Ten browser workflow checks cover copy cancellation/replacement/independence,
  numeric validation, legacy text, Shared notice, purpose/representation preservation,
  draft-only reorder, removal Undo across tabs, long content, timing cancellation
  and parent Save. Representative captures were visually reviewed.
- Native production RemoteViews tests include 32 structured-target captures across
  both languages, all eight appearance pairs and compact/expanded sizes. Existing
  summary, large-text, action, progress, Undo and recovery rendering checks passed.
- Signed release assembly passed. Bundled source-map content matched twelve final
  editor/domain/Focus/history runtime files, including the small-decimal reopen fix.

Private evidence remains ignored under `verification/local/`: `day-tabs-release.log`,
`release-summary.json`, `day-tabs-summary.json`, `day-tabs-matrix/` and
`day-tabs-behaviors/`. Native captures/reports remain in the module build directory.

## Local artifact and limits

APK: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), `arm64-v8a`, min/target SDK 34/36,
nondebuggable, signed and bundled JavaScript; 95,959,311 bytes.

- APK SHA-256: `8e076c740fba8a7001f0a9aed6db4779d453ea40f07701921712e9e44ebf420c`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

Browser/host rendering does not establish Android IME, TalkBack, native pickers,
photo chooser, launcher interaction or physical alarm reliability. The signed-phone
end-to-end cases remain on the [consolidated acceptance checklist](../device-acceptance.md#day-tabs-and-structured-targets-follow-up--18-october-2026).
No installation, distribution or publishing accompanied this work.
