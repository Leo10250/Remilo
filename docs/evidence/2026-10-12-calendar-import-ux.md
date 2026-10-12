# Calendar import browser follow-up — 12 October 2026

The owner reported confusing From/Before labels, reversed selected dates and
already-associated events remaining clickable in the import list. The owner
requested Add all and clarified that it should cover all eligible events in the
selected range. These observations did not identify a device or APK.

## Changes

Start date and End date are inclusive and ordered. Changing either picker keeps
the earlier date first; the default still covers 30 local days. The Google query
uses the day after End date as its exclusive upper bound. Civil-day counting
handles DST rather than dividing actual elapsed instants by 24 hours.

Cached rows are filtered against retained links and captured pending operations,
with native source references scoped to the connected original account. Imported,
detached, erased and pending sources disappear on return. Saved status and
recovery remain in Calendar settings and Details.

Import all scans every page of the selected range, including unsupported-only
pages. It skips unsupported/associated/pending sources and shows the eligible
count before confirmation. The review defaults to Alarm, No list and retaining
Google reminders. Common choices and per-event title/alert/reminder overrides
remain explicit; missing titles or elapsed alerts block confirmation. Large
reviews require a narrower range instead of silently capturing a partial list.

One CE transaction captures every child job and an immutable hash/child-ID receipt
before dispatching I/O. Lost parent replies return the same children. Invalid or
duplicate input rolls back capture. Child local and Google phases retain their
independent outcomes and recovery. Existing event/version/account/generation
guards remain. The pending-operation check uses the existing remote-key index,
avoiding repeated deserialization of the whole job history during batch capture.
Named job titles make individual outcomes identifiable and are suppressed on
purge. CE/DP/portable versions remain 8/6/4; receipts and Calendar state remain
outside backup/DP, and startup begins no Calendar network work.

## Actual verification

Final runtime source: `5821baa67f520e7697e3ef8e0308975a8c83ad6d`, branch
`calendar-import-linked-updates`. The owner's `.vscode/settings.json` modification
was preserved and excluded from commits. Later evidence/backlog edits do not
change the runtime source.

The repository release preparation workflow completed at **2026-10-12 17:19:08
UTC**, running shared checks before native checks and signed assembly:

- Current design/evidence audit, TypeScript and ESLint passed. The existing
  reference-gallery unused-variable warning remains.
- **236 shared tests in 30 suites** and **90 controlled tooling tests** passed.
- **261 native tests in 23 suites** passed, with zero failures/errors/skips.
- Native module/app release lint, signed assembly and APK inspection passed;
  Gradle reported BUILD SUCCESSFUL in 3m 13s.
- Git whitespace checks passed.

New tests cover inclusive range/DST boundaries, date ordering, account/calendar
exclusions, unsupported-only pages, cyclic/stale cursors, lost batch replies,
restart recovery, atomic rollback, duplicate sources, changed-input rejection,
linked default alarms, explicit No alert for elapsed events, independent partial
outcomes and pending source views. Strict VM fixtures retain their isolated
dependency allowlist and lack network/native globals. Existing P4-A and P4-B
regressions remain unchanged.

The synthetic production-component browser was observed at measured **360×800
CSS** in Sky Light. Start/End labels and inclusive explanation appeared; one
initial event page exposed Import all. The all-range review found three eligible
events across three synthetic pages, with Alarm selected and Google suppression
unchecked. One confirmation created three memory-only reminders. Returning to
the cached browser removed the associated row without another Browse action;
another all-range review reported no new eligible events. Unsupported rows
retained their explanations.

Night Dark at **200% text**, with long English/Chinese titles and notes, was
inspected at measured **360×800** and **960×432 CSS**. The heading/account text
wrapped, the page scrolled, and Import all/Cancel remained reachable. Browser
navigation acknowledgements were intermittently delayed before the populated
review became inspectable. No complete new cross-product of all visual states
or Android picker/IME/Back/TalkBack behavior is claimed.

## Identified local artifact and remaining observations

The final release was built from the runtime source above with no runtime edits
during checks/assembly. It is `com.remilo.app` **0.4.0 (4)**, release **arm64-v8a**,
minimum SDK 34/target SDK 36, bundled JavaScript and non-debuggable. Signature
inspection verified the existing beta signer:
`880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

APK SHA-256:
`90eb6fef47d604154ab6c5ea323af098bcfad95292493304791a6f14177a2924`.

An identical private retained copy is
`verification/local/calendar-import-5821baa-app-release.apk`. Private evidence:
`verification/local/calendar-import-ux-build.json`,
`verification/local/release-summary.json` and
`verification/local/calendar-import-ux-release-final.log`.
Signing material, APKs and diagnostics remain ignored/local.

No installation, distribution, real Google authorization/write or physical alarm
observation was performed. The [owner checklist](../device-acceptance.md) now
includes date ordering/end-day inclusion, all-page imports, named partial
outcomes, lost replies and associated/pending row removal. Actual signed-device
and live Google observations remain separate from these host/fixture results.
P4-A sign-off and CAL-01/G4 requirements retain their existing evidence boundaries.
