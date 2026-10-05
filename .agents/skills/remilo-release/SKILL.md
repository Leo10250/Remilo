---
name: remilo-release
description: Prepare a signed Remilo Android milestone build with automated verification. Use for local release preparation; it does not install, publish, commit, push, or declare physical acceptance passed.
---

# Prepare a Remilo milestone

From the repository root, run `npm run release:prepare -- --json`; add
`--abi x86_64` only for that target. It runs shared/tooling checks, native tests and
lint, assembles and inspects a signed APK, and writes a private summary.

Use `npm run doctor` if prerequisites fail. Existing beta signing material is
required; do not replace the identity to bypass a missing key. Finish edits before
checks/assembly and run only one release-producing command per checkout.

Report actual completed checks, APK package/version/ABI/signer and the summary
path. Link the [consolidated owner checklist](../../../docs/device-acceptance.md);
unobserved physical, accessibility and alarm cases remain pending. Update the
[backlog](../../../docs/backlog.md) only with actual results.

Preparation does not install or publish. Deployment, commits and pushes need
applicable user authorization. Keep keys, serials and private diagnostics local.
See [verification guidance](../../../docs/verification.md#development-workflow-and-private-evidence).
