# Redesign milestone handoffs

Each milestone runs in a separate chat. Before starting, read AGENTS.md,
[product](../product.md), [backlog](../backlog.md), [architecture](../architecture.md),
[verification](../verification.md), [appearance specification](../appearance-redesign.md),
the individual plan, [approvals](../design/approvals.md) and every dependency handoff.
Inspect the actual checkout; a plan or status label cannot replace missing evidence.

Create one durable `docs/handoffs/redesign-pNN.md` at milestone completion. Do not
pre-create completed handoffs. They record historical delivery, not a second live
status list. Use these fields:

1. Plan ID, implementation commit(s), base revision and remaining dirty scope.
2. Delivered scope and deliberately excluded work; changed files/interfaces.
3. Consumed dependency handoffs and approval record IDs.
4. Owner acceptance record(s), exact artifact revision/hash and conditions.
5. Commands actually run, exit results, evidence paths and artifact identities.
6. Render matrix, controlled inputs and accessibility evidence where relevant.
7. Storage/backup/API changes and compatibility/invariant results where relevant.
8. Known failures, unobserved device checks and limitations, never inferred passes.
9. Stable contracts/assets the next plan must consume; next bounded task and risks.
10. Links to updated contracts, redacted evidence and the live backlog row.

An executing agent must stop at a missing prerequisite/approval, report the exact
gap and ask the owner for the necessary decision. It may do read-only inspection
but must not silently execute an earlier milestone or treat a partial handoff as
accepted. Refine P02-P12 against actual dependency results before coding; record
that refinement in the same plan rather than inventing another master plan.

Use focused commits. Preserve unrelated work and do not stage it accidentally.
One release-producing workflow per checkout; no installation or distribution
without authorization. A host-complete milestone can hand off with explicitly
deferred physical checks under the owner's consolidated-acceptance instruction.
It cannot claim physical approval, beta verification or distribution permission.
