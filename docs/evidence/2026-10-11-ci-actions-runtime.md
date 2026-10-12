# GitHub Actions runtime update

11 October 2026 · `UX-Improvement` · starting revision `7488b41`.

[Verify run 80](https://github.com/Leo10250/Remilo/actions/runs/38202259865/job/114658005069)
warned that `actions/checkout@v4` and `actions/setup-node@v4` declare Node 20
internally while the runner forces them onto Node 24. GitHub's
[migration guidance](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
requires action versions that support Node 24.

Both shared and Android jobs now use `actions/checkout@v7` and
`actions/setup-node@v7`. The official
[checkout manifest](https://github.com/actions/checkout/blob/v7/action.yml) and
[setup-node manifest](https://github.com/actions/setup-node/blob/v7/action.yml)
declare `runs.using: node24`. Current releases were confirmed as checkout 7.0.1
and setup-node 7.1.0. Their documented runner minimum is 2.327.1; the original job
used hosted runner 2.337.0. The workflow uses ordinary push/pull_request triggers
and no registry-url or legacy always-auth input, so the documented v7 trigger
and authentication changes do not require extra configuration here.

The action runtime and product toolchain are separate: setup-node continues to
read `.nvmrc` and installs **22.23.3** for Remilo. Existing npm caching, full-depth
history, explicit design-baseline preparation, JDK and Android inputs remain.

Actual local verification parsed the complete workflow with the installed YAML
parser, found no syntax errors and checked both jobs' action versions, toolchain
pin, cache/history inputs, event triggers and baseline preparation. Git whitespace
checks and the final design audit passed. Application files did not change; the
[preceding shared and Android results](2026-10-11-design-history-ci.md) were not
repeated for action-reference edits.

A GitHub run using the updated workflow requires pushing both local CI repairs.
The older run's warning is historical evidence, not a new workflow observation.
