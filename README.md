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

## Verification

| Command | What it checks |
|---|---|
| `npm run verify` | TypeScript, ESLint, shared behavioral tests |
| `npm run verify:android` | Kotlin policy/Room recovery tests, native/app lint, bundled release assembly |
| `npm run verify:device` | adb preflight, build hash, pending observation report; does not run alarm tests |
| `npm run build:beta` | Locally signed bundled release APK |

Host tests use Robolectric API 34 for persistence/recovery; they do **not** prove
real audio, idle timing, lock-screen presentation or Direct Boot. Physical tests
require the signed APK, with JavaScript/Metro/network absent. Procedures are in
[docs/verification.md](docs/verification.md). Gates G0/G1 require recorded phone
results; check the backlog for current evidence and remaining observations.

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

Calendar, cloud and iOS remain later gated milestones. This initial slice provides
one-off creation, readiness, Test Alarm and native Stop/quick Snooze; the complete
one-off product follows the physical alarm gate.

The Expo scaffold attribution is retained in `docs/licenses/expo-template-MIT.txt`.
