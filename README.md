# Remilo

Android-first offline reminders, recurring plans and home-screen widgets. React
Native/Expo presents the interface; an autonomous Kotlin engine owns Room, exact
alarms, actions and audio. Local use needs no account, Metro or network.
Optional [Google Calendar integration](docs/calendar.md) supports reviewed publishing,
import and synchronization while preserving independent local delivery.

Read [AGENTS.md](AGENTS.md) for repository boundaries. Current behavior is in
[product](docs/product.md), ownership/recovery in [architecture](docs/architecture.md),
and open work in [backlog](docs/backlog.md).

## Setup

- Node 22.23.3, pinned by `.nvmrc`, with the committed npm lockfile.
- Temurin JDK 17.0.20.1+1; `JAVA_HOME` points to its directory.
- Android platform 36, Build Tools 36.0.0 and 35.0.0, NDK 27.1.12297006,
  CMake 3.22.1 and platform-tools. Set `ANDROID_HOME` to the SDK.
- Expo SDK 57 / React Native 0.86.3; Android 14 / API 34 minimum, API 36 target.

Install Android Studio or the command-line tools and accept Google's SDK terms:

```sh
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "build-tools;35.0.0" "ndk;27.1.12297006" "cmake;3.22.1"
npm ci
npm run verify
```

On the configured Windows workstation, `. ./scripts/use-local-toolchain.ps1`
selects portable tools under ignored `.tooling/`; repository scripts also discover
them. Other hosts use their configured environment. Keep `android/gradlew`
executable on macOS/Linux. `npm run doctor -- --json` diagnoses prerequisites
without downloading tools, accepting terms or creating keys.

## Develop and preview

```sh
npm start
npm run android
npm run preview:ui
```

Use an Expo development build. `android/` is owned source: edit native files
directly and never run Prebuild. Release builds bundle JavaScript. The memory-only
web preview defaults to port 8092; `--port NUMBER` changes it and Ctrl+C stops it.
It is isolated from phone data and Google.

Follow [visual direction](docs/visual-direction.md) and shared components/tokens.
Use [localization guidance](localization/README.md) and `$remilo-localize` for
changed interface copy. Current asset manifests and [brand guidance](assets/brand/README.md)
describe production sources and export maintenance.

## Deploy to your phone

Connect an Android 14+ device, enable USB debugging and authorize this computer.
With the toolchain and existing beta signing identity configured:

```sh
npm run deploy
```

This builds current source and installs an in-place signed update, leaving Remilo
closed. With multiple transports, run `npm run devices`, then
`npm run deploy -- --device SERIAL`. Add `--launch` only to open the app afterwards.
Selection is explicit serial, `ANDROID_SERIAL`, then the sole listed authorized
transport. ARM64 and x86-64 devices select their matching build ABI.

Compare storage compatibility before installing from another branch: equal APK
versions do not imply compatible schemas. Preserve data/signing identity. Never
work around failure with uninstall, data clearing, permission grants, downgrade
flags or an ADB-server restart. Inspect interrupted installation before retrying;
installation and optional launch have separate outcomes.

Create a signing identity only for an initial setup that has none:

```sh
node scripts/create-signing.mjs
npm run build:beta
```

Securely back up the ignored key and `android/signing.properties`. Restore that
identity on another host; losing it prevents updates. The output is
`android/app/build/outputs/apk/release/app-release.apk`. Android verification can
assemble unsigned CI releases without private signing; `build:beta` requires it
and never substitutes a development key.

For Windows Ninja path limits, ignored `android/local.properties` can set
`remilo.cmakeStagingDirectory` to a short local path outside `build/`, such as
`C\:/rn-cxx/remilo` (escape the drive colon).

## Commands

| Command | Purpose |
|---|---|
| `npm run verify` | Localization, docs, assets/presentation, TypeScript, ESLint, shared tests and tooling fixtures |
| `npm run verify:docs` | Local Markdown links, images and anchors |
| `npm run verify:assets` | Current asset/copy/presentation integrity; `verify:design` is an alias |
| `npm run verify:localization` | Catalog structure, bindings and generated-output freshness |
| `npm run test:tooling` | Controlled host workflow fixtures |
| `npm run verify:android` | Native unit tests, lint and release assembly |
| `npm run verify:all` | Combined shared/native checks with a private summary |
| `npm run build:beta` | Signed bundled beta APK |
| `npm run release:prepare` | Combined checks and required signed assembly; no installation |
| `npm run doctor` / `npm run devices` | Read-only prerequisites / transport discovery |
| `npm run verify:device -- --device SERIAL` | Optional local/installed APK hash comparison |
| `npm run device:logs -- --device SERIAL` | Bounded logs; `--follow` streams or `--crashes` selects scoped AndroidRuntime blocks |
| `npm run device:capture -- --device SERIAL` | Current screen capture without navigation/unlocking |

Workflow commands provide `--help`. Doctor, devices, APK comparison and preparation
support `--json`; use `npm run --silent COMMAND -- --json` to omit npm's banner.
Build/verification accepts `--abi x86_64`; ARM64 is the default. Run one
release-producing command per checkout at a time.

See [verification](docs/verification.md) for change-based checks. Logs, captures,
artwork working files and summaries stay under ignored `verification/local/`.
Hash comparison does not establish installed source or alarm behavior. Preparation
does not install, publish, commit or push.

## Code map

- `src/app/`, `src/ui/`, `src/domain/`: screens, shared presentation and domain logic.
- `modules/remilo-alarm/`: bridge, Kotlin engine, storage and Android integration.
- `android/`: owned Android application and build configuration.
- `localization/`: canonical bilingual catalog and language guidance.
- `assets/`: artwork, presentation configuration and current technical manifests.
- `verification/ui/`: isolated production-component preview fixtures.
- `scripts/`: build, deployment, checks and asset maintenance.
- `.agents/skills/`: visual preparation, localization and Android workflows.

Cloud and iOS are future work; iOS remains last. There is no OTA update mechanism.
