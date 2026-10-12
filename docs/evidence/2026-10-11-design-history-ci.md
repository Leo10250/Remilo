# Design-audit history recovery in CI

11 October 2026 · `UX-Improvement` · starting revision
`ca89c782e952972b4fd6227e8908e0029a44cf3d`.

The shared job in [Verify run 80](https://github.com/Leo10250/Remilo/actions/runs/38202259865/job/114658005069)
stopped in the design audit before TypeScript, lint or app tests. Git reported that
`src/ui/recurrence.tsx` did not exist in recorded revision
`3014cd8fcf5539d8881201aee05d82045b5ed150`.

The missing input was the historical commit itself. Its tree contains that file,
with blob `f7fd3b8fa9b4017575515502f7a5f8c0a53b9ec1`, as confirmed locally and
through GitHub. The baseline is outside the ancestry of `UX-Improvement` and
survives locally on the old realignment/cleanup branches. Those refs were absent
from the CI job's advertised remote branches. Its full-depth checkout fetched
current branches and the PR merge ref, which does not include the old baseline.
Git produces the same misleading path error for an unknown full commit SHA.

The active design audit delegates preservation checks to the frozen cleanup
verifier. Changed recurrence code enters its historical hook-rename comparison,
so the missing commit first surfaced through `git show REVISION:path`. The
deletion comparison also needs the original commit. Replacing the baseline with
current source or skipping either check would discard that evidence.

CI now runs [the baseline preparation command](../../scripts/fetch-design-baseline.mjs)
before shared verification. Its [history helper](../../scripts/lib/design-history.mjs)
requires matching full SHAs in both recorded inventories, checks for a commit
object and fetches that exact SHA only when absent. It preserves the checked-out
branch, files and frozen records. Ordinary design verification remains read-only
and reports a missing commit with the exact fetch command before historical path
reads. The existing protection, resource and deletion checks remain in place.

Actual host checks:

- `npm run verify` passed the design audit, TypeScript, lint, **223 source tests
  in 28 files and 88 tooling tests**. The existing unused-variable warning in the
  preserved R8 gallery remains; lint reported zero errors.
- Four new Git fixtures create an unreachable baseline, delete its only branch
  and make a fresh full-depth clone. They verify exact-commit recovery without
  changing checkout state, retained deletion coverage, an actionable read-only
  failure, a failed fetch that does not rewrite evidence, and rejection of
  inconsistent baseline identities.
- A separate private GitHub probe successfully fetched the exact original SHA
  with `--filter=blob:none --depth=1`; `git cat-file -t` returned `commit`.
  It did not modify the product checkout. Probe data and full logs stay ignored
  under `verification/local`.
- The preparation command passed with an existing baseline and reported no
  fetch; its `--help` entry point also passed.
- `npm run verify:android` passed module/app lint and signed bundled ARM64
  release assembly in 1m35s. The native unit-test task was `UP-TO-DATE`; retained
  XML reports contain **222 tests in 22 suites, zero failures and zero errors**,
  rather than a new execution. APK inspection confirmed `com.remilo.app`,
  0.4.0/code 4, signed ARM64. Its SHA-256 remains
  `356ccc20f0efc8b45613bbae7006dd20b1e2c25c8d7dbece8a3a46a2ff912979`,
  the [existing header-transition artifact](2026-10-11-header-transition.md).

The original failed GitHub job has not been rerun with this change. A new CI
result requires pushing the repair. This work does not establish device or
Calendar publishing acceptance.
