# Remilo

Android-first, offline reminders. React Native/Expo presents the main UI; an
autonomous Kotlin engine owns Room, exact alarms, native controls and audio.
The roadmap and implementation state live in [docs/backlog.md](docs/backlog.md).
Read [AGENTS.md](AGENTS.md) before changing this repository.

## Toolchain

- Node **22.23.3** (see `.nvmrc`); npm lockfile is committed.
- Temurin JDK **17.0.20.1+1**. Set `JAVA_HOME` to the JDK, not its `bin` directory.
- Android SDK platform **36**, Build Tools **36.0.0** (AGP also uses **35.0.0**),
  NDK **27.1.12297006**, CMake **3.22.1**, platform-tools.
- Expo **57**, React Native **0.86.3**, Kotlin **2.1.20**; Gradle wrapper **9.3.1**.
- Minimum Android **14 / API 34**, compile/target API **36**.

Install Android's official command-line tools or Android Studio and set
`ANDROID_HOME` to the SDK. Review/accept Google's SDK terms during installation.
Using the SDK's `sdkmanager`, install:

```sh
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "build-tools;35.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
npm ci
npm run verify
npm run verify:android
```

On this Windows workstation, verified portable Node/JDK/SDK installations are
available under ignored `.tooling/`. Run `. ./scripts/use-local-toolchain.ps1`
to select them in PowerShell. Verification scripts discover these installations
themselves. Other hosts use their configured environment. On macOS/Linux, ensure
`android/gradlew` is executable (`chmod +x android/gradlew`).

## Development and signed builds

```sh
npm start
npm run android
```

Use an Expo **development build**, not Expo Go. `android/` is tracked, owned
source. **Never rerun Prebuild**: edit native files directly and rebuild after
native changes. A development build uses Metro; release builds bundle JavaScript.
No OTA updates, backend, Calendar, or iOS implementation are enabled.

Create a local beta signing identity once:

```sh
node scripts/create-signing.mjs
npm run build:beta
```

The script writes `.tooling/signing/remilo-beta.jks` and `android/signing.properties`,
both ignored. Securely back up both outside the repository. Losing the key prevents
in-place updates. Never commit or upload it. Subsequent builds reuse this identity.
On another host, securely restore the key and edit the ignored properties' store path.

APK: `android/app/build/outputs/apk/release/app-release.apk`. Without local signing
configuration, `verify:android` assembles an **unsigned** release for CI; it never
falls back to a development key. `build:beta` requires the private signing config.
No APK distribution or public release happens as part of verification.

## Daily workflow

Connect an Android 14+ test device, enable USB debugging and authorize this computer.
Already authorized wireless devices and running emulators also work. From the repo root:

```sh
npm run deploy
```

This builds current source with the existing beta key, installs an in-place update
for Android user 0, checks the installed APK hash and leaves the app closed. Open
Remilo yourself afterwards. No Metro or network is required by the installed app.
It never uninstalls, clears data, grants permissions, allows downgrades or starts
an alarm test. Installation alone does not establish alarm reliability.

```sh
npm run devices
npm run deploy -- --device SERIAL
npm run deploy -- --dry-run
npm run deploy -- --install-only
npm run deploy -- --launch
```

Target selection is `--device`, then `ANDROID_SERIAL`, then automatic selection
only if exactly one listed transport is authorized. Multiple transports require
explicit selection, including an unauthorized companion. The chosen target must
support ARM64 or x86-64; the build selects its ABI. `--install-only` requires a
matching signed build receipt and displays whether current inputs differ.
`--launch` opens the launcher only after installation verification.

| Command | Purpose |
|---|---|
| `npm run doctor` | Read-only toolchain, dependency, signing and configuration diagnosis |
| `npm run devices` | Transport states, model, Android/API and supported ABIs |
| `npm run deploy` | Signed bundled build, in-place install and installed-hash verification |
| `npm run device:logs -- --device SERIAL` | Bounded Remilo-tagged snapshot; add `--follow` for streaming, Ctrl+C to stop |
| `npm run device:capture -- --device SERIAL` | Screenshot of the current screen; no unlocking or navigation |
| `npm run preview:ui` | Fixture-only UI preview on port 8092; add `--port NUMBER` |
| `npm run verify:all` | Shared/tooling tests plus Android unit tests, lint and assembly |
| `npm run release:prepare` | Full host verification, required signed build and pending owner-check summary |
| `npm run test:tooling` | Controlled workflow/process/device fixtures without installing on a phone |

Every command accepts `--help` after `--`. Doctor, device listing, deployment,
preflight and release preparation accept `--json`; build/test subprocess output
goes to stderr in JSON mode. To obtain pure JSON without npm's banner, use
`npm run --silent doctor -- --json` (or the corresponding command).
`build:beta`, `verify:android`, `verify:all` and `release:prepare` accept
`--abi x86_64`; their default is ARM64. Deployment chooses from the actual target.

Scripts select the pinned project-local Node/JDK/SDK when available, including
re-executing with the pinned Node. Doctor reports overrides and conflicting SDK
configuration; it never downloads tools, accepts terms, creates keys or edits the
machine. Build subprocesses remove preview-only variables from their environment.

Build/deployment receipts, logs and screenshots stay under ignored
`verification/local/`. A receipt records the actual APK, signer and stable build
inputs; stale receipts cannot authorize installation. Release-producing workflows
share a lock so an APK cannot be replaced during inspection or deployment. After
a crash or an unconfirmed child-tree shutdown, confirm the workflow/build processes
ended before manually removing `verification/local/release.lock`. Do not restart
the shared ADB server to work around a connection problem.

Repository skills in `.agents/skills` are discoverable by Codex:

- `$remilo-deploy`: requested test-device deployment and build identity reporting.
- `$remilo-device-debug`: connections, scoped logs/screenshots and read-only preflight.
- `$remilo-release`: signed milestone preparation with honest pending acceptance.

The release command does not install, publish, commit or push. Keep signing keys
and raw device evidence local. See [receipt/evidence guidance](docs/verification.md#toolkit-receipts-and-private-evidence).

## Verification

| Command | What it checks |
|---|---|
| `npm run verify` | TypeScript, ESLint, shared behavioral tests and tooling fixtures |
| `npm run verify:android` | Kotlin policy/Room recovery tests, native/app lint, bundled release assembly |
| `npm run verify:device` | adb preflight, build hash, pending observation report; does not run alarm tests |
| `npm run build:beta` | Locally signed bundled release APK |

Host tests use Robolectric API 34 for persistence/recovery; they do **not** prove
real audio, idle timing, lock-screen presentation or Direct Boot. Physical tests
require the signed APK, with JavaScript/Metro/network absent. Procedures are in
[docs/verification.md](docs/verification.md). Gates G0/G1 require recorded phone
results; check the backlog for current evidence and remaining observations.
The owner's next run uses [one device acceptance checklist](docs/device-acceptance.md).
New offline Android features are compiled and host-tested; pending physical results
are not a verified release claim.

## Repository guide

- `src/app/`: React Native principal UI and refresh hints.
- `modules/remilo-alarm/src/`: typed asynchronous native interface.
- `modules/remilo-alarm/android/`: engine, protected Room stores, Android components,
  tests and generated Room schema history.
- `android/`: startup, permissions, backup exclusions and build setup.
- `scripts/`: cross-platform verification, signing and evidence collection.
- `docs/product.md`: authoritative behavioral requirements.
- `docs/architecture.md`: ownership and consequential decisions.
- `docs/implementation.md`: phased delivery and acceptance contracts.
- `docs/backlog.md`: **only** task/status source.
- `docs/verification.md`: evidence requirements and manual procedures.

The offline app provides separate event/due/alert timing, native actions and grouped
ringing, settings, management/search/history, backups, recurrence, series actions
and protected replenishment. See [offline build evidence](docs/evidence/2026-10-04-offline.md)
for automated results and the APK identity. Calendar, cloud and iOS remain later
gated milestones; no integration scaffolding is included.

The redesigned **0.4.0 / versionCode 4** build uses one event-date agenda, categorized
automatic settings, inline permissions and native alarm controls that close only
after confirmed session termination. [Redesign evidence](docs/evidence/2026-10-04-redesign.md)
and [the owner checklist](docs/device-acceptance.md) distinguish host checks from
pending physical acceptance. Install as an update with the existing signing key.

For local visual review only, run `npm run preview:ui`. This uses synthetic reminders without
touching phone data. Android always uses the native module. Default configuration
remains Android-only; this preview does not verify native pickers, audio or OS text
scaling. Preview variables are confined to its child process. An occupied port
produces an error; the command never terminates the process using it.

The owned vector master is `assets/brand/remilo.svg`. `node scripts/brand.mjs`
exports all Android/Expo variants using Sharp (0.34.x); alternatively supply the
installed Sharp package path as its argument. This does not invoke Prebuild.

The Expo scaffold attribution is retained in `docs/licenses/expo-template-MIT.txt`.
