---
name: remilo-deploy
description: Build and install Remilo's signed Android beta when the user requests deployment to a test phone or emulator. Use the repository command; ordinary code edits or release preparation do not authorize installation.
---

# Deploy Remilo

From the repository root, run `npm run deploy`. It builds current source with the
existing beta key, installs an in-place update and leaves the app closed.

Use `--device SERIAL` for a named target; otherwise the script respects
`ANDROID_SERIAL` or selects the sole listed authorized transport. When targets
are ambiguous, use `npm run devices` and obtain the intended target. Add `--launch`
only when the user wants the app opened. Deploy's other option is `--help`.

Use `npm run doctor` only for prerequisite troubleshooting. Do not precede routine
deployment with a compulsory diagnostic, verification or release-preparation chain.
Run one release-producing command at a time in this checkout.

Keep the existing signing identity and data. Do not work around failures by
uninstalling, clearing data, granting permissions, adding downgrade flags or
restarting ADB. After a cancelled install, report the uncertain outcome rather
than retrying automatically. Report installation separately from a launch failure.

Report the selected model, APK package/version/ABI and whether the app was opened.
Do not claim installed-hash verification or alarm reliability. Read the
[workflow guide](../../../README.md#deploy-to-your-phone) for setup or failures;
keep unobserved physical checks in the [owner checklist](../../../docs/device-acceptance.md).
