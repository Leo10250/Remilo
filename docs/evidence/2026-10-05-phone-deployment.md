# Owner-requested phone deployment — 5 October 2026

> Implementation evidence at the revision/build recorded below. This report
> preserves observed checks, counts, hashes and limitations; it is not the target
> visual specification. Use [the current design](../design/current/README.md) and
> [TD roadmap](../plans/redesign/README.md) for new UI/theme work. Physical checks
> remain pending unless this report records an actual observation.


The owner requested installation of the latest app. One authorized Pixel 9 Pro XL
was selected explicitly, running Android 17 / API 37 with ARM64 support.
Device identifiers and raw receipts remain under ignored `verification/local`.

## Installed build

- `npm run deploy -- --device SERIAL --json` built the signed bundled release and
  Android confirmed successful `install -r --user 0`. Data was not cleared and the
  launcher was not opened.
- Built source: `996d43870db272162148b72f694d7bfae892cb2c`, clean at assembly.
  Build-input SHA-256:
  `25f7a61c8fa0462c488c6c0a9333c5dfa8ea4a6a3fdb08acbcaa4e1458478784`.
- Package `com.remilo.app`, version **0.4.0 / versionCode 4**, ABI **arm64-v8a**,
  minimum API 34, target API 36, non-debuggable, bundled JavaScript present.
- APK and installed base APK SHA-256:
  `006c984fae7cb236b8b8bfe766f106a291a6d5d9376d606174637b125e6deed5`.
- Verified existing signer certificate SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

## Post-install inspection correction

The first deployment receipt accurately records successful installation with failed
verification. Android returned a readable `/data/app/~~…/…/base.apk` path, but the
tooling allowlist rejected `~` and incorrectly suggested unlocking the device.
The parser now accepts that character while retaining the single-base-APK and
shell-character restrictions. This changes host tooling only; installed application
code, version and signing identity are unchanged.

`npm run test:tooling` passed **35 tests**, including randomized-directory/CRLF
acceptance and missing/split/unsafe-path rejection. `npm run lint` and
`git diff --check` passed. Commands used `npm.cmd` in PowerShell to preserve flags.

The corrected read-only `npm run verify:device -- --device SERIAL --json` returned
`ok=true` and `matchesLocalApk=true`. No second installation was attempted. The
preflight retains the original clean build source separately from the workspace
containing the tooling correction. Original deployment, build receipt and successful
preflight remain private; the failed deployment receipt was not rewritten.

No alarm scenarios, permission changes, screenshots or interactive phone tests were
performed. The [owner acceptance checklist](../device-acceptance.md) remains the
next physical verification step; installation/hash matching does not prove alarm
reliability or authorize distribution.
