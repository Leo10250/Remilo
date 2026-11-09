# iPhone AlarmKit probe

This standalone app checks offline alarm delivery and lock-screen actions using a synthetic reminder. It runs on iOS 26 or later and keeps the probe's state separate from Remilo data.

## Build and install

Open `AlarmKitProbe.xcodeproj` in Xcode 26.1 or later on a Mac. From the repository root, an unsigned simulator build checks that the project and native APIs compile:

```sh
xcodebuild -project verification/ios-alarmkit/AlarmKitProbe.xcodeproj \
  -scheme AlarmKitProbe -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

For device testing, select your Apple development team under **Signing & Capabilities**, enable automatic signing, and choose the connected iPhone as the run destination. Use a unique probe bundle ID if Xcode requests one. A personal Apple Account can use an Xcode Personal Team for a local test. Enable Developer Mode if the iPhone prompts for it. After installing, stop the Xcode run, disconnect the iPhone, and open the app from its Home Screen to test without the debugger. [Device signing](https://developer.apple.com/documentation/xcode/building-and-running-an-app) · [Testing without the debugger](https://developer.apple.com/documentation/xcode/testing-a-release-build)

With Windows and a free Apple Account, the [probe build workflow](../../.github/workflows/ios-alarmkit-probe.yml) can compile an unsigned iPhone IPA on a GitHub-hosted Mac when the probe branch is pushed. Download the `AlarmKitProbe-unsigned` artifact and extract the IPA. AltServer on Windows can sign and install an IPA with a personal development certificate. Follow the provider's Windows setup, connect and trust the phone, and hold Shift while opening the AltServer tray menu to choose **Sideload .ipa…**. Enter Apple Account details locally and enable Developer Mode on the phone if prompted. Free provisioning expires after seven days. The workflow and re-signed probe still need to be tested. [GitHub macOS runner](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md) · [AltServer setup](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows) · [Direct IPA installation](https://github.com/altstoreio/FAQ/blob/main/release-notes/altserver.md) · [Apple Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account/)

## Run on the iPhone

Allow alarms when prompted. Use **Ring in 1 minute** for most runs and **Ring in 3 minutes** when you need time to restart. On the Lock Screen, use **Mark as done** on iOS 26.0 or the system **Stop** control starting with iOS 26.1. Both exercise the probe's Done action. **Postpone** should dismiss the current alert and register another alarm for one minute later under a new AlarmKit UUID, keeping the same fixture ID. Open the probe from the Home Screen and tap **Refresh** to inspect the result, IDs, and timestamps. **Reset test** clears probe state and cancels only probe-owned alarms.

1. **Baseline.** Schedule, lock the phone, and wait. Record when the alert appears and rings. Use the primary action, reopen the probe, and check for one Done result for that fixture.
2. **Offline and force-quit.** Turn on Airplane Mode and verify Wi-Fi is off. Schedule, swipe the probe away in the app switcher, then lock the phone. Observe ringing and try the primary action before reopening the probe. Record whether the phone demanded unlock and whether Done was recorded.
3. **Postpone.** Repeat the offline run and use Postpone on the Lock Screen. Confirm the first alert stops and the second rings one minute later. Use the primary action, then confirm a new alarm UUID, the same fixture ID, one completion, and that the original UUID is absent from the iOS registry. Note any action that opened the app or demanded unlock.
4. **Permission, Silent Mode, and Focus.** With alarm access denied, confirm the probe reports that it could not schedule. Re-enable access and repeat the baseline with Silent Mode and with Focus enabled, recording what you hear and see in each case.
5. **Reboot before first unlock.** Schedule for three minutes out and restart. Count the run only if the Lock Screen returned before the scheduled time and the phone has not been unlocked since restarting. Record delivery and action availability separately. Apple documents that secondary intents are available only after first unlock. [AlarmKit configuration](https://developer.apple.com/documentation/alarmkit/alarmmanager/alarmconfiguration)

Use synthetic data only. Record the iPhone model, exact iOS version, scheduled and observed times, action results, and any differences between the observed UI and the probe history. Keep private observations or captures under `verification/local`. The Xcode build and physical scenarios have not been run in the Windows worktree.
