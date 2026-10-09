# Current-design repository cleanup

8 October 2026 · branch `design-docs-cleanup` · target `theme-update` ·
starting revision `3014cd8fcf5539d8881201aee05d82045b5ed150`.

[A37](../design/approved-design-cleanup.json) authorizes removal of superseded
design material and review demos while protecting the current design and
implemented behavior. [Current contracts](../design/current/README.md) remain
the only maintained visual/workflow specification; all eight R3 images govern
atmosphere and visual language.

## Delivered cleanup

- Removed exactly **1,905 files / 207,109,957 bytes (197.52 MiB)** using the
  [path/hash/reason inventory](time-of-day-realignment/cleanup-manifest.json).
  This covers superseded specs, archive copies, old artwork/icon variants,
  P01/P02 captures, review demos, generated catalogs, exporters and dedicated tests.
- Preserved all **11 current contract files**, **223 files in seven accepted
  reference bundles**, **22 associated current approval/intake/fixture records**
  and **45 unrelated backlog rows**. Accepted bundles retain their internal
  generation/draft records as the owner's explicit exception.
- Moved two exact Classic source images into
  [static branding references](../../assets/brand/reference/manifest.json).
  The associated supplied board and all shipped geometric R exports remain intact.
- Removed historical AR/RD task rows, obsolete execution gates and archive routes.
  Current agent guidance, six TD plans, approval ledger and compatibility entrypoints
  route to maintained contracts. Plain branch naming is recorded in agent guidance.
- Retained implemented native/product behavior, schemas, backup compatibility,
  deployment tooling, ordinary web preview and nine clearly labeled implementation
  evidence reports. Native alarm renderer and callbacks remain unchanged.
- Preserved reusable optional component styling; replaced generated catalog types
  with explicit roles/geometry and renamed presentation hooks/row options without
  changing ordinary defaults. The recurrence editor changes only its hook import/call.
- Added `verify:design` and included it in shared verification. CI fetches history
  for comparison with the approved starting revision. No obsolete checkout archive
  or legacy specification redirect was recreated.

## Verification

[Protected baselines](time-of-day-realignment/immutable-baseline.json) record
original working-byte SHA-256 and original repository Git blobs. Both identities
are recorded because Git's existing text rules can produce different checkout
line endings across operating systems; accepted file contents are unchanged.

- Design audit: current contracts present; all protected bundle/record hashes
  match; all removals absent; both Classic moves match; unrelated backlog rows
  retained; active Markdown, JSON and gallery resources resolve. Frozen submissions'
  removed-plan citations are explicitly mapped to their original Git revision.
  Original generation intermediates remain identified as provenance, not live
  gallery dependencies. [Structured results](time-of-day-realignment/validation.json).
- Shared verification: TypeScript, ESLint, **63 domain tests in 11 files**, and
  **45 tooling tests** pass. Tooling includes preview isolation and a regression
  that detects committed, staged, unstaged and untracked cleanup changes.
- Android verification: **96 native tests in 10 suites**, module debug lint,
  app release lint and required signed ARM64 release assembly pass. No failed,
  errored or skipped native tests. Assembly completed in 3m19s.
- Built `com.remilo.app`, **0.4.0 / versionCode 4**, signed ARM64 bundled release.
  APK SHA-256: `83c85bff3c372aecdf6858be1504fa26eb874e40959dcfaba066942a61dc6094`.
  The APK and detailed logs remain ignored local outputs.
- Ordinary web fixture preview: HTTP **200**, root document present, and compiled
  entry bundle HTTP **200**. Its 7,962,178-byte development bundle includes the
  memory-only preview engine and excludes the removed demos. The task-owned
  server was stopped after checking it.
- Git whitespace checks pass. The protected galleries have no content diff.

The initial sandboxed Vitest/cache and Gradle-cache attempts were not passing
results; the final checks above ran with access to their existing host caches.
Two delegated documentation/verifier tasks stopped at an account usage limit.
Their saved changes were reviewed and completed directly; only the shared-code
agent completed its independent focused checks. No completed review is attributed
to the failed agents.

## Boundaries

This cleanup implements no new appearance preference, artwork, page redesign,
production icon, runtime API, persistence migration or scheduling behavior.
No device installation, alarm interaction, distribution or physical accessibility
verification occurred. TD implementation, R9 image review, the list-icon decision
and the existing G1/G2/G3 physical observations remain pending.

Removed material is recoverable through the recorded Git revision. The current
checkout contains no separate archive of superseded design instructions.
