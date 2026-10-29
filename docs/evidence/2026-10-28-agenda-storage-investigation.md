# Phone Agenda load failure — 28 October 2026

The owner supplied a phone screenshot showing Agenda's generic "Could not load
this view" state after running npm run deploy. The screen is a rejected native
query with no loaded items, rather than evidence of a JavaScript render crash.

## Initial read-only observations

- Repository device discovery found one authorized Pixel 9 Pro XL on Android 17.
- The installed APK and current local release APK both have SHA-256
  `2516722a62662895001663bb4c04bd8a92b4ccca10efdccfc7e7b215711fc8fa`.
  This identifies the installed bytes; the current Git branch alone does not.
- The bounded Remilo-tagged log snapshot contained no entries. Native request
  handling maps storage exceptions to generic error codes without their cause.
- The chooser build expects CE13/DP8. The separate event-routines and
  assistant-action-research branches expect CE17/DP9. Their DP8 schema also differs
  from chooser DP8. A phone previously using those builds could fail when this
  older storage implementation opens its data. The owner is unsure which build
  preceded this deploy; actual phone database versions have not been observed.
- The chooser's own DP7-to-8 migration matches its exported schema and has
  receipt-preservation coverage. That does not test an installation over a newer
  or conflicting feature branch's database.

## Diagnostic change

Native request/background failures gain a bounded allowlist summary: failure
category and numeric Room migration versions, or schema identity mismatch.
Arbitrary exception messages, SQL, titles, notes, paths and credentials are not
logged. Existing bridge error codes and storage/scheduling behavior are preserved.
Regression cases reproduce newer-storage rejection and verify marker data/version
preservation. At that stage, this was a diagnostic change; the phone cause remained
unconfirmed until the authorized installation below.

No device navigation, installation, data clearing or settings changes accompanied
the initial read-only investigation. The prepared diagnostic APK required a separate
installation/launch instruction before collecting the actual native cause. Private
serials, logs and APKs remain under ignored verification/local.

Task status and subsequent observed outcomes belong in docs/backlog.md.

## Automated diagnostic build evidence

Shared verification passed 300 application tests and 97 controlled tooling tests.
Android verification passed 504 tests across 44 suites, zero failures/errors,
module/app lint and signed ARM64 release assembly. Nine new cases cover safe
classification and rejection without data/version loss. The resulting APK is
com.remilo.app 0.4.0 (4), ARM64, signed, SHA-256
`673e810a5446c7f17d331ec6c112aed6105a56dd0b29c7519b27138a81f0e91b`.

After reviewing that prepared result, the owner explicitly authorized installing
and opening the diagnostic build. That instruction does not itself establish an
installation, launch or actual phone root-cause result.

## Observed phone cause

After the owner's explicit instruction, repository deploy reported successful
in-place installation and opening on the Pixel 9 Pro XL. A new scoped log recorded
`type=room_missing_migration from=9 to=8 exception=IllegalStateException` for native
startup and requests. This confirms that the installed chooser build attempted an
unsupported operational-database downgrade. The phone's credential database
version was not observed, so CE17 remains a branch fact rather than a phone claim.

The owner chose to restore the compatible Routines app first, leaving Postpone in
its separate PR. There was no uninstall, data clearing, downgrade migration,
destructive fallback or permission change. Restoration outcomes must be recorded
separately from diagnosis; the diagnostic installation alone did not repair Agenda.

## Owner-selected compatible restoration

The restoration checkout is `restore-compatible-routines`, based on
`event-routines` at `0639f6c` with the focused Robolectric CI change applied as
`49bfd62`. Its source retains the CE17/DP9 schema and Routines implementation.
This is a compatible source baseline for the observed operational version 9;
the phone's credential-database version remains unobserved. The uniform Postpone
implementation stays in its separate PR and is not merged as part of this
restoration.

The restoration carries the bounded storage-failure diagnostics into that
baseline without altering schema, scheduling or Routines behavior. Preparation
must use the existing signing identity, run relevant shared/native checks and
identify the actual compatible release APK. The restored app is then installed
in place through the repository deploy command, preserving the existing database
files; no uninstall, data reset, downgrade migration or destructive fallback is
part of this work.

The diagnostic build/test counts and APK hash above identify only the earlier
diagnostic artifact. Compatible restoration results follow separately. The
consolidated alarm, TalkBack and release gates remain distinct from restoring a
readable app.

## Compatible release verification

The compatible source passed 334 shared tests, 105 controlled tooling tests and
598 native tests across 46 suites, zero failures/errors, module/app lint and signed
ARM64 release assembly. The initial shared run found stale ignored Expo route
declarations from the other branch; Expo 57's installed typed-route setup API
regenerated them for the actual Routines routes, after which shared verification
passed. No Prebuild, Android regeneration or test weakening was used.

The compatible APK is com.remilo.app 0.4.0 (4), ARM64, signed with the existing key,
SHA-256 `9e4d3822e14dfa6ff3244caaec9a647ee37b392b06b0e1892a263da3a1834f86`.
Source retains CE17/DP9 unchanged; only the isolated SDK staging fix and bounded
failure diagnostics augment the event-routines baseline. All local DP9 branches
inspected use the same schema identity. This source comparison does not establish
the phone's credential-database version.

## Observed restoration outcome

The owner's choice to restore the compatible app was followed through with the
repository deploy command, using the same selected phone and existing signing
identity. It reported successful in-place installation and opening of
com.remilo.app 0.4.0 (4), ARM64, on the Pixel 9 Pro XL. The optional read-only APK
comparison then reported a match: the installed and local APK both have the
compatible hash recorded above.

The fresh scoped log reported `Recovery finished` with unlocked/exact/
notifications/channel true. The collected snapshot contained no Room failure.
A read-only screen capture was black, so no direct visual Agenda observation is
claimed from it. The owner then explicitly confirmed **"Agenda loads normally"**
after being asked to unlock/open Remilo and check their reminders. This is the
owner's physical observation, distinct from automated tests and native logs.

No uninstall, data clearing, destructive fallback, forced downgrade, permission
grant, ADB restart or alarm-test sequence was used. The working checkout remains
restore-compatible-routines. PR #20 received a visible compatibility notice;
the Postpone chooser must be integrated forward with Routines storage before
being deployed over this phone's data. No new restoration branch was published.
Other Routines, alarm/audio, picker, Direct Boot, accessibility and distribution
gates were not exercised or closed by this restoration.
