---
name: remilo-release
description: Prepare a signed Remilo Android milestone build with automated verification and provenance. Use for local release preparation; it does not install, publish, commit, push, or declare physical acceptance passed.
---

# Prepare a Remilo milestone

Read [AGENTS.md](../../../AGENTS.md), the relevant task in
[the backlog](../../../docs/backlog.md), and
[verification guidance](../../../docs/verification.md). Work from the repository root.

Run `npm run doctor -- --json` and resolve prerequisite failures. Existing beta
signing material is required; never create a replacement identity to bypass a
missing key. Finish edits before assembly so the receipt can identify stable inputs.

Run `npm run release:prepare -- --json`, adding `--abi x86_64` only for that target.
It runs shared/tooling tests, native unit tests and lint, assembles and inspects the
signed APK, and writes private build/evidence receipts. If verification fails,
fix the underlying problem; never weaken tests or reuse an unrelated passing report.
If build inputs change during execution, finish edits and repeat preparation.

Report source commit/dirty state, input fingerprint, APK version/ABI/hash/signer,
actual completed checks and the private summary path. Link the
[consolidated owner checklist](../../../docs/device-acceptance.md). Physical,
accessibility and alarm scenarios without observations remain pending.

Update the backlog/evidence only with actual results. This skill's command neither
installs nor publishes. Deployment, commits and pushes require applicable user
authorization; a preparation request alone does not authorize them. Keep signing
material, device identifiers and private diagnostics out of Git.
