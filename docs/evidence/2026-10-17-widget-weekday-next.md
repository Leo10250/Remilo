# Widget weekday, plain exercise name and compact Next context

Source baseline: `d596d61`. The owner requested the supplied clean reference's
information hierarchy: no added number before the current exercise, a quiet Next
line at bottom left, and the full weekday at top right. The existing Done/Undo
controls, current atmosphere/brightness tokens and native dated authority remain.
Task status belongs only in the backlog.

## Presentation changes

Production, native setup examples and generated picker previews share the same
composition. The exercise name is authored text without an added ordinal. Its
original position remains in the accessible exercise description. The header
formats the projection's exact date as a localized full weekday; the complete
localized date remains accessible and all routes/actions retain the original date.

Compact Routine adds one 14 sp supporting Next line at the left gutter below the
exercise/action row. Compact Today uses its existing footer: Next left, Agenda
right with a full target. Expanded views keep one Next label with upcoming content.
The label derives from the native session's second unfinished step, skipping checks.
It disappears when no next exercise exists, for ended/rest/skipped/unavailable
states, and in compact recovery/summary views. A long name ellipsizes at the end
while its complete accessible description remains available.
The localized Next caption uses the existing typed message so an authored name
matching sample content is preserved rather than accidentally translated.

Compact spacing uses 4 dp after the header and title, 12 dp after progress and 2 dp before
Next. Native font metrics budget the added line while preserving full 56/48 dp
actions. The reference host remains interactive at 300×200 dp; taller vendor fonts
or increased text still use the shared measured preview and summary fallback.
The static XML picker fallback uses the same plain localized name, weekday,
spacing and Next hierarchy. Its canonical theme colors are unchanged. A new
composition cache key requests refreshed generated previews while respecting
Android's rate limit and launcher caching.

No engine command, progress storage, schema, backup format, native scheduling,
Undo ownership, localization entry, dependency or artwork changed.

## Regression scope

Production RemoteViews checks cover all seven weekdays in English and Simplified
Chinese, full spoken date/position, plain exercise names, Next alignment and
supporting color/type, full Done/Undo/Agenda bounds, next-unfinished selection,
terminal omission, long names and text sizes through 200%. The XML fallback is
inflated in both languages and compared with the same localized sample hierarchy.
Existing eight-appearance, progress, repeated Undo, exact Retry, reminder time,
setup/picker and native session regressions remain part of the full workflow.

Signed-phone launcher resizing, font rendering and TalkBack remain on the
[consolidated checklist](../device-acceptance.md). Host rendering does not establish
those observations; installation and distribution require separate authorization.

## Final checks and local artifact

`npm run release:prepare -- --json` passed on 17 October 2026 at 18:46 PDT
(`2026-10-18T01:46:26.665Z`). Localization (2,150 EN/ZH messages), maintained design
and preserved references, TypeScript, ESLint, 316 shared tests in 39 files,
97 tooling tests, all 574 native tests in 42 suites, module/app lint and signed
release assembly passed. Native results contain zero failures, errors or skips.
The production widget render suite contains 23 cases. Module/app lint retains
27/20 existing warnings with zero errors; the frozen R8 gallery warning remains.

Native rendered checks exposed the additional line's font-height requirement;
the compact spacing and height budget were corrected without shrinking targets
or weakening glyph-bound checks. The final suite includes both language paths,
all seven weekdays and all eight appearance pairs. Visual review covered the
eight Routine appearance captures, English/Chinese weekday renders and Today's
shared Next/Agenda footer. These are host renders of production RemoteViews,
not observations from a phone or launcher.

Artifact: `android/app/build/outputs/apk/release/app-release.apk`, package
`com.remilo.app`, version 0.4.0 (4), ARM64 `arm64-v8a`, min/target SDK 34/36,
bundled JavaScript, nondebuggable, 95,759,591 bytes.

- APK SHA-256: `2e1d92a1d810bb835b8a9e0c4bf100dc35688ba60e63ae51a0b44d82297627c7`.
- Existing beta signer SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Workflow summary: `verification/local/release-summary.json`.
- Retained task summary: `verification/local/widget-weekday-next-summary.json`.
- Final design audit: `verification/local/widget-weekday-next-design-final.json`.

No installation or distribution accompanied these checks. Signed-phone vendor
font, launcher resize/update and TalkBack cases remain on the consolidated checklist.
