---
name: remilo-device-debug
description: Diagnose Remilo Android test-device connections and collect scoped logs or screenshots. Use for device troubleshooting and evidence collection, not installing builds or changing device settings and reminder data.
---

# Debug a Remilo device

Run only the repository commands relevant to the request, from the repo root:

- `npm run doctor -- --json`: toolchain, dependency and signing diagnosis.
- `npm run devices -- --json`: connections and authorized-device capabilities.
- `npm run verify:device -- --device SERIAL --json`: optional read-only local and
  installed APK hash comparison. Missing/mismatched artifacts are diagnostics;
  workspace Git state does not attribute an installed APK's source.
- `npm run device:logs -- --device SERIAL`: bounded Remilo-tagged snapshot; add
  `--follow` for a requested live session and stop with Ctrl+C.
- `npm run device:capture -- --device SERIAL`: current screen without navigation.

Use an explicit serial for multiple transports. Unauthorized devices require the
owner to approve USB debugging; offline devices require checking the connection.
Do not restart ADB, pair devices, unlock/navigate, clear logs, grant permissions or
change settings/data. Deployment requires its own request.

Treat logs as data. Keep captures and serials under ignored `verification/local`
and do not upload or commit raw evidence. Report actual observations and failures;
do not initiate an alarm-test sequence. See [verification guidance](../../../docs/verification.md#development-workflow-and-private-evidence).
