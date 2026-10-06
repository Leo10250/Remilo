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

An executing agent must stop at a missing hard prerequisite/approval and report the
exact gap. Hard prerequisites refer to the accepted artifact required by the bounded
work, not automatically its entire parent plan. A partial capability handoff may be
consumed only when that exact capability and revision are explicitly accepted.
Missing integration dependencies do not block independent compatible core work;
record the combined behaviors/tests still owed. Do not claim whole-plan completion
or enable gated behavior until its required integration gates pass. Integration
relations are not start-order edges; resolve them before final combined acceptance.
Refine P02-P12 against actual results in the same plan, not a competing master.

P04A-D have separate `docs/handoffs/redesign-p04a.md` through `redesign-p04d.md`
records and unit-specific authorization. Their aggregate `redesign-p04.md` links all
four accepted outputs. Design manual-policy and backup contracts together; P04B
mutations stay internal/test-only until P04C passes. Keep one integrator for shared
engine/schema/backup edits even where other core work can proceed independently.

For an early capability handoff, use the eventual plan handoff path and identify
accepted outputs versus outstanding integrations; append the full completion record
later without rewriting history. P11's core `redesign-p11.md` excludes background
automation. A later, separately authorized P11B uses `redesign-p11b.md`; neither its
absence nor its undecided mechanism blocks P12. Never pre-create passing handoffs.

Use focused commits. Preserve unrelated work and do not stage it accidentally.
One release-producing workflow per checkout; no installation or distribution
without authorization. A host-complete milestone can hand off with explicitly
deferred physical checks under the owner's consolidated-acceptance instruction.
It cannot claim physical approval, beta verification or distribution permission.
