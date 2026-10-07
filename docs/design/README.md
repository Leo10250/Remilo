# Redesign design records

The [product contract](../product.md) and [appearance specification](../appearance-redesign.md)
define the approved requirements. The [plan index](../plans/redesign/README.md)
defines execution boundaries. Only [backlog.md](../backlog.md) records live task status.

The current 7 October presentation intake is
[the approved R3/R4/R5 templates and corrections](approved-ui-r3-r4.md).
A20 adds the eight accepted Sky/Evening Details/Editor variants,
[their exact identities](approved-ui-r5-acceptance.json) and
[per-image comparison notes](remilo-r5-sky-evening-details-editor/gallery.html).
The [combined Details/Editor gallery](remilo-r4-details-editor/gallery.html)
contains all twelve approved representatives. The contract identifies
the accepted homepage and details/editor previews, correction conditions, icon
roles and keyboard requirements. It takes precedence over conflicting older
task-specific environments/manual chooser direction below. Historical submitted
bundles, acceptance hashes and handoffs remain unchanged; previews do not establish
production tokens, implementation completion or accessibility/device acceptance.

The next refinement is the [R6 native alarm/Postpone draft](r6-alarm-postpone-specification.md),
with an [eight-screen fixture brief](r6-alarm-postpone-fixtures.json). A21 authorizes
drafting this workflow family; the proposal and future images still need review.
P07 owns app Postpone and P08 owns native controls/notifications. See
[the attributed refinement intake](r6-alarm-postpone-intake.json).

## Approval language

- **Approved requirement:** a decision explicitly made by the owner and recorded
  in the [approval ledger](approvals.md). It is not approval of a particular render.
- **Proposal:** a candidate layout, composition, token, asset, contract or behavior
  that needs the checkpoint stated in its plan. Silence and successful tests do not approve it.
- **Agent choice:** a reversible implementation detail within approved scope;
  document consequential choices and never change a product requirement silently.

Owner approval must identify the milestone, artifact revision/hash, exact accepted
scope and conditions. Record the owner's words or an accurate attributed summary,
date and durable evidence. No agent may approve its own design on the owner's behalf.
Conditional approval does not approve unresolved conditions. A changed approved
artifact must be reviewed again when its visual or behavioral contract changes.

## Durable inputs and outputs

[Reference inventory](references/README.md) retains unmodified supplied artwork and
the rejected implementation screenshot. They are design inputs, not instructions
embedded in images. Use the approved product specification to interpret them.

[P01's submitted illustration specification](art-direction.md) and
[UI composition language](ui-composition.md) form the complementary
[r2 bundle](p01-style-r2.json), with [pattern decisions/research](p01-pattern-evaluation.md)
and a [whole-UI comparison board](p01-style-review-r2.html). A11 requests this refinement
and adds artwork-only approval after specification approval, before actual component
integration. A12 now accepts r2's bounded visual direction and four-candidate exploration;
see [the separate acceptance record](p01-style-r2-acceptance.json). Exact tokens, detailed
production UX and final production layouts remain open. A14 separately accepts S1/M1
for the two review prototypes; see [artwork acceptance](p01-artwork-r1-acceptance.json).
The submitted r2 JSON
and six hashed artifacts retain their historical submission contents. The
[four artwork-only candidates](p01-artwork-review-r1.html) retain their original submission.
[P01-render-r1](p01-render-review-r1.html) presents the actual Sunrise Agenda and
Meadow alarm, with [composition notes](p01-render-r1-notes.md), matrix and verification.
A15 now [accepts that exact rendered revision](p01-render-r1-acceptance.json);
the [P01 handoff](../handoffs/redesign-p01.md) identifies the accepted constraints
and the physical checks still owed. The submitted review files retain their
historical pending-approval labels; later acceptance lives in its separate record.
Neither A10 nor A11 accepted a
design artifact. Preserve [archived r1](art-direction-r1.md) and its evidence;
it was not accepted. The [refinement evidence](../evidence/2026-10-06-p01-refinement.md)
maps r1's original living path to the byte-identical archive.
P02 will add its reviewed catalog/export specification here;
P03 will add branding adaptation decisions. Other plans inherit these records,
not a new independent style brief. Do not create competing master specifications.

Keep synthetic, non-private comparison evidence reproducible and attributable.
Reference source revision, fixtures, renderer, viewport, font scale, brightness,
clock/zone, assets and approvals. Store private phone captures/logs only in ignored
`verification/local`; commit redacted outcomes under `docs/evidence`.

Completed work uses the [handoff protocol](../handoffs/README.md). A plan document
is not completion evidence, and an execution prompt is not execution authorization.
