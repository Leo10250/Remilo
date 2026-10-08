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

The [R6 native alarm/Postpone specification](r6-alarm-postpone-specification.md)
now has [eleven accepted reference images with annotations](remilo-r6-alarm-postpone/gallery.html).
[A22](approved-ui-r6-acceptance.json) accepts R6-01/02/03/05/06/07/08 and rejects
the plain R6-04. All native alarm states use the four global atmospheres, including
a privacy-safe themed presentation before first unlock. A23 requires softer Dark
surfaces matching the existing themes. [A24](approved-ui-r6-themed-alarm-acceptance.json)
accepts the four corrected Dark replacements as starting templates: backgrounds
must use the corresponding existing theme's shared color roles, with exact detailed
coloring and overall visual polish open for later refinement;
the [updated fixture brief](r6-alarm-postpone-fixtures.json) preserves the state
identities. P07 owns Postpone and P08 owns native controls/notifications. Technical
storage/capture decisions, implementation and actual rendered acceptance remain
separate from this visual approval.

The owner now requests identifying the remaining screens and starting refinement
with **all eight R3 images** as color/style references and the established UX (A25).
[The coverage map](screen-refinement-map.md) lists the remaining families.
[R7 Lists/Repeats and recurrence controls](r7-lists-repeats-specification.md) is the
next concrete layout/state specification, with an
[all-four-theme Light/Dark fixture brief](r7-lists-repeats-fixtures.json).
A26 authorizes generation; [A27](approved-ui-r7-outline-acceptance.json) now accepts
the overall UI/UX outline with a provisional decorative-list-icon decision.
[The twelve-reference gallery](remilo-r7-lists-repeats/gallery.html) has per-image
discrepancy notes. The owner favors omitting decorative list icons and wants the
choice raised during implementation; no custom list-icon picker is authorized.
Unrendered Night/state permutations may inherit established themes. Production
P05/P06/P07 and actual component/physical acceptance remain separate.

[A28](r8-settings-appearance-intake.json) continues with
[R8 Settings, Appearance, permissions and Test alarm](r8-settings-appearance-specification.md).
The [thirteen-screen fixture brief](r8-settings-appearance-fixtures.json) uses
all eight R3 style references, separate brightness/global atmosphere selection,
auto-saving preferences, inline Android permission handoffs and native sound/test
feedback. A29 authorizes generation; [A30](approved-ui-r8-outline-acceptance.json)
accepts the R8 direction/templates shown before its response. The
[thirteen associated references](remilo-r8-settings-appearance/gallery.html) have
per-image corrections; R8-08 is a subsequent supplement. Automatic boundaries/
defaults/migrations and identified Test-alarm retry remain separate technical
decisions. [Refinement evidence](../evidence/2026-10-07-r8-settings-refinement.md) and
[generation evidence](../evidence/2026-10-07-r8-images-and-approval.md) record actual
checks and runtime limits, not component or physical verification.

[A31](r9-completed-trash-activity-intake.json) continues with the proposed
[R9 Completed, Trash and Activity specification](r9-completed-trash-activity-specification.md).
Its [fourteen representative review states](r9-completed-trash-activity-fixtures.json)
use all eight R3 Light/Dark references; the first eight cover every pair.
Collections remain secondary to their invoking origin, and Activity remains
read-only recorded history for one occurrence. Collection rows show current
state without treating native sort fallback values as action timestamps; exact
recorded times remain in details and Activity. Skipped Reopen retains the skipped
state. Baseline Browse-root routing and collection uncertain-command retry guards
remain implementation gaps, not changes completed by this refinement.
[The refinement evidence](../evidence/2026-10-07-r9-records-refinement.md) records
actual checks and their limits. R9 is proposed: no images or new acceptance,
production implementation, task-status change or device verification are implied.
Data/Help is the next unrefined family, followed by the remaining exceptional states.

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
