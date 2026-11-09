# Verification and development workflows

Choose checks according to changed behavior and risk. Report actual commands and
observations, with important failures/limitations in the handoff. Routine work
needs no new evidence document, permanent physical acceptance row or reconstruction
of earlier testing. Known failures and important deliberately skipped checks belong
in the relevant task or [backlog](backlog.md).

## Host checks

| Command | Coverage |
|---|---|
| `npm run verify` | Prettier, localization, local docs links, current assets/presentation, TypeScript, ESLint, shared tests and Node tooling fixtures |
| `npm run verify:expo` | Installed dependency versions against the current Expo SDK's compatibility recommendations |
| `npm run verify:docs` | Maintained Markdown links/images/local anchors; no network |
| `npm run verify:assets` | Current manifests, file facts, copies and generated presentation; `verify:design` is an alias |
| `npm run verify:localization` | Bilingual messages, argument/plural shape, escaping and generated-output determinism |
| `npm run test:tooling` | Controlled host/process/build/device fixtures without real installation |
| `npm run verify:android` | Spotless, native unit tests, module/app lint and bundled release assembly |
| `sh verification/ios-engine/run.sh` (macOS) | Swift storage, commands, simulated delivery, civil recurrence, dated routine progress and durable local Calendar export intent |
| `sh verification/ios-archive/run.sh` and `sh verification/ios-media/run.sh` (macOS, after `pod install`) | Portable archives and normalized routine photos |
| `sh verification/ios-calendar/run.sh` (macOS) | Protected Google account state, authorization fences, event normalization, managed setup, resumable incoming scans, local import recovery and automatic links scoped to the managed calendar |
| `npm run verify:all` | Shared plus Android checks and assembly, with a private summary |
| `npm run release:prepare` | Combined checks and existing-key signed assembly; no installation/publication |

Run focused tests during changes and the appropriate integrated check afterwards.
Repeat broader suites only for changed inputs, failures or unresolved concerns.
Preserve behavioral assertions when retiring historical documentation/audit tests.

Android tests cover policy, Room migration/recovery, command identities and lifecycle
simulations. Robolectric's pinned API 34 SDK/resource dependencies are staged through
Gradle; resolution failure is not a skipped/passing behavioral check. Host tests do
not establish physical audio, OEM presentation, real idle timing or accessibility.

Asset checks establish current file integrity and selection consistency. Encoded
header checks do not establish decoded pixels or visual quality; deterministic
export/audit fixtures use Pillow for those claims. Authorized asset edits update
the current manifest, without historical commits, approval files or deletion lists.

## Expo dependency compatibility

Run `npm ci`, then `npm run verify:expo` from the repository root. This runs
`expo install --check --json` with the installed CLI and reports mismatches without
editing the manifest or lockfile. The shared CI job runs this check on dependency
pull requests. Local `npm run verify` and release preparation keep their existing
checks.

If Expo reports a mismatch, use `npx expo install <package>` for the affected
packages, review the manifest and lockfile changes, then run `npm ci` and
`npm run verify:expo` again. Keep fixes within the current SDK. If the CLI falls
back to the bundled version map because Expo is unreachable, rerun with network
access to confirm the current recommendation.

## Source formatting

From the repository root, run `npm run format` to format JavaScript and TypeScript
or `npm run format:check` to check without writing. VS Code recommends the Prettier
extension and uses it for those languages. Enable format on save in your editor
settings if you want it.

For Kotlin, run the Gradle wrapper from `android/`. Use `spotlessApply` to format
app and alarm module source and tests, or `spotlessCheck` to check without writing.

```powershell
.\gradlew.bat :app:spotlessApply :remilo-alarm:spotlessApply
.\gradlew.bat :app:spotlessCheck :remilo-alarm:spotlessCheck
```

```sh
./gradlew :app:spotlessApply :remilo-alarm:spotlessApply
./gradlew :app:spotlessCheck :remilo-alarm:spotlessCheck
```

Both formatters skip generated source. The localization and asset checks verify
that those files still match their generators.

CI runs shared and Android verification separately and cancels older runs for the
same PR or branch and event type. The Android job reuses Gradle downloads. If
Android verification fails after producing lint or unit test reports, find them
in the failed run's `android-verification-reports` artifact for seven days.

## Match validation to the change

- Documentation: local links/anchors, current intent and useful ownership.
- UI: production-component preview, meaningful interactions, English/Chinese and
  affected narrow/large-text layouts; native behavior needs native/device checks.
- Localization: [language guidance](../localization/README.md) and `$remilo-localize`;
  catalog parity and linguistic quality are separate checks.
- Engine/storage/actions: relevant cases for stale input, exact retry, interrupted
  writes, privacy, compatibility and recovery.
- Asset tooling: geometry, alpha/color, decoded pixels, copies, safe paths,
  complete prevalidation, stale/concurrent publication and interrupted recovery.
- Build/deploy scripts: controlled argument, cancellation, signing/data and
  reporting fixtures before an authorized device operation.
- Calendar: relevant consent/comparison/transport/recovery cases; fixture state
  does not establish real Google transport or background timing.

## UI preview

`npm run preview:ui -- --port 8092` runs memory-only fixtures through production
components. Preview variables remain child-only and are stripped from release
builds. Fixtures cannot initialize real scheduling, credentials, Google transport,
persistence or native actions.

Inspect affected empty/loading/error/recovery states. Cover atmosphere/brightness
variants for shared theme changes and larger text/narrow widths for layout/copy.
Keep temporary captures ignored. Screenshots do not establish focus, Back, keyboard,
TalkBack, native pickers or alarm behavior.

## Physical testing

Physical checking is part of normal development. Use the installed signed bundled
build for actual delivery observations; browser/Metro results are insufficient.
There is no permanent per-feature pass/pending ledger.

Select relevant scenarios from this reusable release smoke menu:

- Delivery with app closed, another app foregrounded, screen locked, offline and
  under Android idle/battery restrictions.
- Done/Postpone and group-member scope, stale actions, original audio cutoff,
  time selection/cancellation and required unlock handoff.
- Reboot/process recovery without elapsed-alert replay; independent future
  registrations and Direct Boot privacy.
- Data-preserving in-place upgrade/restore when storage/export changes.
- Changed UI/native/widget behavior, English/Chinese, text scaling/accessibility.
- Live Calendar authorization, both directions, conflicts, uncertain writes and
  relevant background/reconnection opportunities.
- On iPhone or iPad, separate AlarmKit/Notification authorization, delivery while
  locked or the app is closed, system Done/Postpone, and replenishment of repeats
  after reopening. Check both supported languages and system-owned control labels.

This is a menu, not a full matrix required for every feature. A reported failure
remains actionable; absence of old paperwork alone is not a failure. Describe the
scope of new reliability claims without inferring coverage from generic success.

## Build and device workflows

Run one release-producing command per checkout at a time. Build/deploy use Gradle
and ADB without receipts or Git prerequisites. Android verification can assemble
unsigned CI releases; beta/preparation commands require existing private signing.
Summaries report actual checks/artifacts without assigning physical-acceptance status.

Requested deployment uses `npm run deploy`, without compulsory doctor/full-check/
preparation chains. It builds current source, installs an update and leaves UI
closed. `--device SERIAL` selects the target; `--launch` opens it when requested.
Otherwise selection uses `ANDROID_SERIAL` or the sole listed authorized transport.
Multiple transports, including unauthorized companions, need explicit selection.

Compare actual storage compatibility when switching branches. Equal APK versions
do not prove compatible schemas. Unsupported newer/unknown storage retains its
bytes and fails closed. Keep signing/data; never bypass failure with uninstall,
data clear, permission grants, downgrade flags, replacement keys or restarting ADB.
Cancelled installation is uncertain; inspect before retrying. Installation and
optional launch have separate outcomes.

`verify:device -- --device SERIAL --json` compares optional local/installed APK
hashes. Missing/different artifacts are diagnostic; inspection errors fail. A
match establishes bytes, not source attribution or physical alarm behavior.

### iOS build

Use macOS with CocoaPods and Xcode 26.4 or newer for Expo SDK 57. Select the Node
version in `.nvmrc` and run these commands from the repository root.
[Expo SDK 57 toolchain reference](https://docs.expo.dev/versions/v57.0.0/#support-for-android-and-ios-versions).

```sh
npm ci
sh verification/ios-engine/run.sh
sh verification/ios-calendar/run.sh
(cd ios && pod install)
sh verification/ios-archive/run.sh
sh verification/ios-media/run.sh
xcodebuild -workspace ios/Remilo.xcworkspace -scheme Remilo \
  -configuration Release -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

`ios/` is owned source. Edit it directly and never run Prebuild. Windows can run
shared verification and export the JavaScript bundle. Xcode compiles and links
the native iPhone/iPad app on macOS.

The [iOS build workflow](../.github/workflows/build-ios.yml) runs the Swift
engine, widget policy, Calendar, archive and photo checks on macOS. It compiles
the optional WidgetKit extension separately. The standard unsigned Release
package checks for bundled JavaScript, sound, App Intents metadata and
iPhone/iPad device families.
Device installation requires separate signing. The AlarmKit probe checks OS
feasibility. Physical acceptance uses a signed build of Remilo itself.

#### iPad or iPhone from Windows

1. Open a successful iOS workflow run and download the **Remilo-unsigned**
   artifact. Extract the ZIP and put **Remilo-unsigned.ipa** in Files on the
   device.
2. Start AltServer on Windows. Connect and trust the device by USB, or use
   the same network after Wi-Fi sync is set up.
3. On the device, open **AltStore → My Apps → +** and choose the IPA from
   Files. Open Remilo after installation.
4. In Remilo, use **Settings → Permissions & alarm check → Alarm** to allow
   alarms, then tap **Test alarm**. Create a real reminder and choose a PM time
   that falls on the next UTC date in its zone, such as 9:09 PM Pacific. Check
   the time after closing the picker, saving, and reopening the reminder.
   Repeat with the device's 24-Hour Time setting on and off and check that
   the picker and reminder use the same clock format.
   Inspect its state after dismissing the alarm. Test the explicit Done and
   Postpone actions separately. Open Reminder actions for a ringing alarm,
   replace or dismiss that delivery, and verify the old action screen can no
   longer change the reminder.
5. Open **Settings → Tomorrow shortcuts** and edit a time. Confirm Done saves
   the exact minute and Cancel discards the edit. Check the new time in the
   postpone chooser with both system clock formats.
6. Complete a test routine date. In Records, move it to Trash and restore it,
   then check that the saved steps are still completed. Move the test date back
   to Trash and permanently delete it. Relaunch and confirm the routine plan
   and its other dates are still available.

[AltServer connection requirements](https://faq.altstore.io/altstore-classic/altserver)

#### Google Calendar on a sideloaded iPhone or iPad

Use an app-only build that includes the iOS Calendar UI. First install the
unconfigured Remilo IPA through AltStore. Use the bundle identifier reported
by the installed device, since AltStore can assign a different identifier when
it signs the app. Keep the same AltStore account and signing team for the
configured build. [AltStore provisioning implementation](https://github.com/altstoreio/AltStore/blob/develop/AltStore/Operations/FetchProvisioningProfilesOperation.swift)

On Windows, connect and trust the device over USB. With `pymobiledevice3`
installed according to its documentation, run this in PowerShell. Use the
single identifier for the Remilo installation you just installed.
[pymobiledevice3 installation](https://doronz88.github.io/pymobiledevice3/master/installation/)

```powershell
$installed = py -m pymobiledevice3 apps list --type User | Out-String | ConvertFrom-Json
$installed.PSObject.Properties |
  Where-Object { $_.Value.ALTBundleIdentifier -eq 'com.remilo.app' -or $_.Value.CFBundleDisplayName -eq 'Remilo' } |
  Select-Object -ExpandProperty Name
```

In Google Cloud, enable the Calendar API and create an OAuth client of type
**iOS** for that exact identifier. For an External app in Testing, add the
Google account you will use on the device as a test user. The first read-only
import requests `openid`, `email`, `calendar.calendarlist.readonly`, and
`calendar.events.owned.readonly`. Select the OAuth client ID shown in Google
Cloud. [iOS OAuth clients](https://developers.google.com/identity/sign-in/ios/api-access)
[OAuth test users](https://support.google.com/cloud/answer/15549945)
[Calendar scope reference](https://developers.google.com/workspace/calendar/api/auth)

Put the original unsigned IPA in `verification/local`. From the repository,
set these two variables to your actual values and run the helper. On macOS use
`python3` with the same arguments.

```powershell
$bundleId = 'ACTUAL_INSTALLED_BUNDLE_ID'
$clientId = 'YOUR_IOS_OAUTH_CLIENT_ID'
py scripts/configure-ios-test-ipa.py verification/local/Remilo-unsigned.ipa verification/local/Remilo-calendar-test.ipa --bundle-id $bundleId --client-id $clientId
```

The helper writes a new app-only IPA using public OAuth configuration. It
preserves the input app identifier and existing URL schemes and rejects a
host app signature, provisioning profile, or embedded extension. Put
`Remilo-calendar-test.ipa` in Files and select it in AltStore under
**My Apps → +** to install over the baseline. Open Remilo, connect the test
Google account, and import one future event from a calendar that account owns.
Check the local reminder time and delivery mode. Relaunch and confirm saved
status can be inspected after reconnecting the same account. Change an event
after opening its review and verify that confirmation asks for fresh review.
Review a supported repeating event with one cancelled date and one moved date.
Check the next dates in Review, then open the saved repeat from its import
result. Check that the cancelled date is absent from upcoming dates and the
moved reminder in Agenda keeps its authored time. With a second repeat, change
an instance after opening Review and verify that confirmation requests a fresh
review even when the series details stay the same.

For one-time publication, select a publishing destination that the same Google
account owns and grant access to `calendar.events.owned` from the publish
review. Check that the destination still has the same events after consent.
Review and confirm a local one-time reminder. Verify its title, notes, date,
and time in Google Calendar, then edit the local reminder and inspect the
saved result.
Reopen Remilo and verify the published status is available from saved data. If
the initial response was interrupted after sending, reauthorize the same
account and check that the retry recovers a single event with the original ID.

On an active one-time reminder previously imported or published, open its
Calendar review. Change the title in Remilo and the notes in Google, choose
the Remilo title and Google notes, and confirm. Check both sides after
confirmation. Change the Google event while a second review is open and verify
that it requires a fresh review. On a reminder with a future postponed alert,
choose a revised Google schedule and verify that Remilo keeps the postponed
alert time. If a write result is interrupted, reconnect
the same account with read access and check the result against the original
event. If the outcome is still unconfirmed and the event has since changed,
open a fresh review and confirm. Verify the old operation is cancelled and
the new result reflects the reviewed event.

Use Check for changes on a manual link after editing the Google event. Verify
the saved check reports the difference while the Remilo reminder keeps its
title and alert. Turn off network access and check again to verify the last
observation stays visible. Delete the Google event and check that a confirmed
deletion appears on Agenda and Details. If the same event is restored, check
that the link still requires review. Unlink and verify that the reminder and
restored Google event remain.

On a healthy one-time link, turn on automatic sync after reviewing the two
copies and granting write access. Change the Remilo title and Google notes,
then check the same link with Sync now. Verify both edits converge and a
second check reports no changes. Change the same field on both sides and
verify the association requests review. Complete and reopen the reminder
before another check. Verify the original permission stays paused, then
review again or turn off automatic sync. The reminder and Google event
should remain linked when automatic sync is turned off.
Keep the configured test IPA local.
[AltServer connection requirements](https://faq.altstore.io/altstore-classic/altserver)

#### iOS widget build

The standard unsigned Remilo build omits the widget extension. To build the
widget-enabled app, use one Apple development team authorized for both App IDs
(`com.remilo.app` and `com.remilo.app.widgets`) and give both profiles the
`group.com.remilo.app.widgets` App Group. Select that team and build the
extension before the app with the same configuration and build directory.
[Apple App Groups setup](https://developer.apple.com/documentation/xcode/configuring-app-groups)

```sh
REMILO_WIDGET_FIXTURE=1 sh verification/ios-engine/run.sh
export REMILO_DEVELOPMENT_TEAM=YOUR_TEAM_ID
build_dir="$PWD/verification/local/RemiloWidgets-build"
xcodebuild -project ios/Remilo.xcodeproj -scheme RemiloWidgets \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$build_dir" DEVELOPMENT_TEAM="$REMILO_DEVELOPMENT_TEAM" build
xcodebuild -workspace ios/Remilo.xcworkspace -scheme Remilo \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$build_dir" DEVELOPMENT_TEAM="$REMILO_DEVELOPMENT_TEAM" \
  REMILO_WIDGETS_ENABLED=YES build
app="$build_dir/Build/Products/Release-iphoneos/Remilo.app"
codesign -d --entitlements :- "$app"
codesign -d --entitlements :- "$app/PlugIns/RemiloWidgets.appex"
```

Confirm the App Group in both signatures. On a signed iPhone or iPad, open
Remilo once, add both widgets from the Home Screen gallery, and exercise
configuration, refresh after a reminder change, exact dated navigation, large
text, both languages, and behavior across lock, midnight, and time-zone changes.
After midnight with Remilo closed, check the new day's preview. Open Remilo to
refresh and check that the current day's actions become available.
In a medium or large Routine Focus widget, tap Done while Remilo is closed and
confirm only the displayed step changes. Tap an older rendering after changing
the dated session in Remilo and check that stale progress stays unchanged.
In Remilo's widget settings, create two profiles for the same routine and
select a different profile in each widget's Edit Widget panel. Complete a step
in one widget and verify that only that profile offers Undo. Check Undo after
the last step and after a later completion from inside Remilo. Retry an
uncertain action and verify it applies the captured step once. The optional
Swift fixture covers interrupted commits and exact Retry.

The host's conditional entitlement path belongs to the Xcode project
configuration. Expo autolinking reads target-level paths as inputs to its
provider-generation script. An empty expansion at target level makes the
whole iOS directory an input, including the provider the script generates.

For an AltStore Classic test, the input IPA needs the widget embedded and the
App Group present in both original code signatures so AltStore can read and
re-provision it. Keep the widget extension during sideloading. The extension
uses an additional App ID, and App Group provisioning must succeed for the
Apple account used to sign. The standard unsigned IPA covers app-only testing.
[AltStore App IDs](https://faq.altstore.io/altstore-classic/app-ids)
[AltStore provisioning implementation](https://github.com/altstoreio/AltStore/blob/develop/AltStore/Operations/FetchProvisioningProfilesOperation.swift)

## Private diagnostics and handoff

Doctor/devices provide read-only diagnosis/discovery. `device:logs` captures
bounded Remilo logs; `--follow` streams a requested session, while `--crashes`
selects exact-package AndroidRuntime blocks. `device:capture` captures the current
screen without unlocking/navigation. Never clear logs or upload raw captures.
Keep serials, credentials, keys, captures and summaries in ignored local storage.

Report checks, actual artifact/device observations and concrete remaining issues
in chat or the PR description. Preserve distinctions between build, installation,
launch, hash comparison, preview and physical behavior. Installation, remote
publication and distribution require applicable user scope; preparation does not
perform them.
