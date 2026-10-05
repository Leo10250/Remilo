# Deployment simplification — 5 October 2026

This milestone changes repository tooling and documentation. Application behavior,
version **0.4.0 / versionCode 4**, package `com.remilo.app` and the existing signing
identity are preserved.

## Resulting workflow

`npm run deploy` selects an authorized target, chooses ARM64 or x86-64, builds and
inspects a signed bundled release, and installs with `adb -s SERIAL install -r
--user 0`. It does not open the launcher unless `--launch` is supplied. Android's
installer handles signing compatibility and version downgrade rejection.

Deploy supports `--device SERIAL`, `--launch` and `--help`. Removed options fail
before tool/device work. Builds and deployment no longer depend on Git queries,
source fingerprints, receipts, release locks, installed certificate inspection or
post-install hash verification. Old private evidence was left intact. Run one
artifact-producing command at a time per checkout.

Optional doctor, device discovery, logs, screenshots, UI preview, verification
and release preparation remain available. Optional device preflight compares
available hashes without source attribution; a mismatch or absent artifact is a
diagnostic, while an inspection/transport error fails.

## Host verification

- `npm run release:prepare -- --json` passed TypeScript, ESLint, **20 shared
  tests**, **35 controlled tooling tests**, native tests, module debug lint,
  app release lint and signed ARM64 assembly. Native test task was up-to-date;
  its reports contain **65 tests, zero failures/errors/skips**.
- `npm run build:beta -- --json` passed ARM64 assembly and actual APK inspection.
- `npm run build:beta -- --abi x86_64 --json` passed signed x86-64 assembly and
  inspection. Final release preparation restored the ARM64 output for the Pixel.
- Both artifacts contain bundled JavaScript, are non-debuggable, require API 34
  and target API 36, and retain signer certificate SHA-256
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- A final deployment-output clarification distinguishes an unconfirmed requested
  launch from default no-launch behavior. ESLint and all 35 tooling tests passed
  again after that wording change; application/build inputs were unchanged.
- Tooling fixtures cover transport ambiguity/state, flag precedence, API/ABI
  rejection, unsigned/wrong package/bundle/version artifacts, build/signing
  failures, nondestructive install arguments, cancellation, installer failures,
  separate launch outcomes, spaces, removed options and preview environment
  isolation. They do not contact a phone.
- All 13 documented workflow command help paths passed. Doctor returned
  `ok=true`, `signingReady=true`; pinned Node/JDK selection overrides the older
  global installations. The existing Gradle deprecation notices remain.
- Three repository skills passed the bundled skill validator and invocation
  metadata checks. An independent review found no blocking deployment defect.
- `git diff --check` passed.

Private build outputs, logs and summaries are under ignored `verification/local`.
Release summaries record completed commands and inspected artifact identity;
they do not infer source provenance from the current Git revision.

## Read-only device observation and pending acceptance

Discovery identified the connected authorized Pixel 9 Pro XL, Android 17 / API 37,
ARM64. The optional preflight returned `ok=true`, `comparison=match` for the
previously installed APK and the ARM64 artifact. No installation, app launch,
permission change, reminder mutation, screenshot or alarm test occurred in this
milestone. The earlier deployment remains recorded in
[its historical evidence](2026-10-05-phone-deployment.md).

The simplified real-device deployment smoke remains **pending**. The owner should
connect/authorize the phone, run `npm run deploy`, confirm the command completes
without opening Remilo, then open it and confirm the version and existing
reminders. Product/alarm acceptance remains in the
[consolidated checklist](../device-acceptance.md); successful installation alone
does not pass those gates.
