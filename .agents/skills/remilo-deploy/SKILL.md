---
name: remilo-deploy
description: Build and install Remilo's signed Android beta when the user requests deployment to a test phone or emulator. Use the repository deployment command; ordinary code edits or release preparation do not authorize installation.
---

# Deploy Remilo

Work from the repository root. Read [AGENTS.md](../../../AGENTS.md) and the
[workflow guide](../../../README.md#daily-workflow). Use the scripts instead of
reimplementing signing, APK inspection, device selection or installation.

- When deployment is requested, run `npm run devices -- --json`. Respect a named
  target or `ANDROID_SERIAL`; select automatically only when there is exactly one
  authorized transport. If several targets remain ambiguous, ask which one.
- Run `npm run deploy -- --device SERIAL --json`. Default deployment builds
  current source, preserves app data and leaves the UI closed. Add `--launch`
  only when the user wants it opened. `--install-only` is for an explicitly
  requested existing artifact with its matching local receipt.
- For a preview of actions, use `--dry-run`. Use `npm run doctor -- --json` for
  prerequisite failures. The toolkit never repairs the machine automatically.
- Preserve the existing signing identity. Never work around failure by uninstalling,
  clearing data, granting permissions, allowing a downgrade, replacing the key,
  force-stopping the app or restarting the shared ADB server.
- After a cancelled install or failed post-install inspection, report installation
  and verification separately. Use `npm run verify:device -- --device SERIAL --json`
  for read-only inspection; do not retry an uncertain operation automatically.

Report the selected device/model, source commit and dirty/input-difference status,
actual package/version/ABI, installed-hash verification, launch state and private
receipt path. Keep serials and private evidence out of commits. Installation does
not establish alarm reliability; link the [owner checklist](../../../docs/device-acceptance.md)
and leave unobserved scenarios pending.
