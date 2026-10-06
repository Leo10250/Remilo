# Redesign design records

The [product contract](../product.md) and [appearance specification](../appearance-redesign.md)
define the approved requirements. The [plan index](../plans/redesign/README.md)
defines execution boundaries. Only [backlog.md](../backlog.md) records live task status.

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

P01 is to create `docs/design/art-direction.md`: the single approved illustration,
composition and responsive style contract. It does not exist yet and must not be
assumed approved. P02 will add its reviewed catalog/export specification here;
P03 will add branding adaptation decisions. Other plans inherit these records,
not a new independent style brief. Do not create competing master specifications.

Keep synthetic, non-private comparison evidence reproducible and attributable.
Reference source revision, fixtures, renderer, viewport, font scale, brightness,
clock/zone, assets and approvals. Store private phone captures/logs only in ignored
`verification/local`; commit redacted outcomes under `docs/evidence`.

Completed work uses the [handoff protocol](../handoffs/README.md). A plan document
is not completion evidence, and an execution prompt is not execution authorization.
