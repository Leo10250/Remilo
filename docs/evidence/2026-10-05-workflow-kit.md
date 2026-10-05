# Development workflow kit evidence — 5 October 2026

## Scope and source

Tooling and repository skills only. No application behavior, migrations, integrations
or version bump were introduced. Tested implementation source:
[8d075dabb2e4edfae64a44bb4fca5290ffd93afa](https://github.com/Leo10250/Remilo/commit/8d075dabb2e4edfae64a44bb4fca5290ffd93afa),
with a clean working tree during assembly. Build-input SHA-256:
`25f7a61c8fa0462c488c6c0a9333c5dfa8ea4a6a3fdb08acbcaa4e1458478784`.

## Host checks

- `npm run verify`: TypeScript and ESLint passed; **20 shared tests** passed.
- **33 tooling tests** passed using controlled device/process fixtures. Cases cover
  selection precedence and connection failures, API/ABI selection, APK configuration,
  missing signing, incompatible signer/version, in-place arguments, build failures,
  receipt/hash/source races, cancellation, separate installation/verification outcomes,
  default no-launch, optional launch, dry-run, paths with spaces, lock exclusion,
  scoped logs and preview environment isolation.
- `npm run release:prepare -- --json`: passed shared checks, native unit-test task,
  module debug lint, app release lint and required signed ARM64 assembly. Native
  report contains **65 tests**, zero failures/errors/skips. Gradle used its normal
  incremental task reuse: 28 tasks executed, 1,004 up-to-date.
- `npm run build:beta -- --abi x86_64 --json`: signed x86-64 assembly and actual APK
  inspection passed; 67 tasks executed, 768 up-to-date. No emulator was created or
  used for installation/runtime testing.
- Required signed ARM64 assembly was repeated after the x86-64 check to restore the
  Pixel artifact. Its receipt revalidated successfully, including the current input
  fingerprint and the APK metadata/hash.
- Doctor returned `ok=true` and `signingReady=true`. It correctly reported switching
  from global Node to pinned Node and selecting the local JDK instead of global JDK 21.
- All documented commands' `--help` paths exited successfully. JSON output from
  doctor, devices, dry-run and release preparation was parsed successfully.
- All three skills passed the bundled `quick_validate.py`. Invocation metadata and
  repository reference checks passed. PyYAML 6.0.3 was installed only into ignored
  local validation tooling; no application dependency was added.
- Fixture preview returned **HTTP 200** on port 8092. A second invocation returned
  `PORT_BUSY` without stopping that server. The task-owned preview was subsequently
  stopped. Child-only preview variables are stripped from release environments.
- `git diff --check` passed.

## Inspected build identities

Both artifacts are signed, non-debuggable bundled releases for `com.remilo.app`,
**0.4.0 / versionCode 4**, minimum API 34 and target API 36.

| ABI | APK SHA-256 |
|---|---|
| ARM64 | `006c984fae7cb236b8b8bfe766f106a291a6d5d9376d606174637b125e6deed5` |
| x86-64 | `c6a94a1469e23504edee5a6453680b568b15b0c99ce33a604db0e77ce10cac36` |

Signer certificate SHA-256:
`880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
This is the existing beta identity. The ARM64 artifact matches the previous UI
redesign artifact, as expected for tooling-only changes. Build receipts include
Node 22.23.3, Java 17.0.20.1, Build Tools 36.0.0, ADB 1.0.41, selected tool paths,
lockfile hash and completed checks. Receipts/artifacts remain ignored local output.

## Device observations and pending work

Initial device listing detected one **unauthorized** transport. Deployment dry-run
returned `DEVICE_NOT_READY`, with installation and verification both not attempted.
A later read-only preflight could access the Pixel 9 Pro XL on Android 17 / API 37;
it reported `INSTALLED_MISMATCH` because no matching installed user-0 APK hash was
available. A subsequent default dry-run succeeded, selected ARM64 and listed the
planned build/inspection/in-place-install/hash-check steps without executing them.
No authorization/unlock request, build installation, permission change, settings
change or alarm-testing sequence was initiated. Device identifiers stay local.

Real end-to-end deployment, installed signer/hash inspection, device logs/screenshots
and emulator runtime behavior remain pending. Their failure branches and orchestration
have host fixture coverage; that is distinct from device execution. The owner can
connect/authorize the intended device and run `npm run deploy`, adding `--device`
when several transports are listed. Default deployment leaves Remilo closed.

Subsequent [owner-requested phone deployment](2026-10-05-phone-deployment.md)
records successful installation and installed-hash matching, including a correction
to inspection of Android's randomized APK directories. The preceding observations
describe the original workflow-kit run.

The [consolidated acceptance checklist](../device-acceptance.md) and G1/G2/G3 remain
pending. A successful future installation does not establish alarm reliability or
authorize distribution. Signing keys, raw logs, screenshots and serials were not
committed or uploaded.
