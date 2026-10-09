# R10 revision 2 — whole-backup Restore clarification

Recorded 8 October 2026 against starting commit
`c128fd166e53165bdc6969be52c30716888729f0`. Documentation and synthetic
UI-example revision only; no app/native/schema or actual backup action.

## Owner decision and history

The original [A32 intake](../design/r10-data-help-intake.json) and
[r1 refinement evidence](2026-10-08-r10-data-help-refinement.md) retain the original
continuation scope and checks. [A33](../design/r10-data-help-image-intake.json)
records the subsequent generation request, **“Based on these specs, generate
images for UIs”**, and the frozen r1 specification/fixture hashes.

The fourteen generated examples are saved in the current projectless review
bundle, outside this repository:

- [R10 gallery](C:/Users/Leo/Documents/Codex/2026-10-08/based-on-these-specs-generate-images/remilo-r10-data-help/gallery.html)
- [Original submitted specification](C:/Users/Leo/Documents/Codex/2026-10-08/based-on-these-specs-generate-images/remilo-r10-data-help/submission-specification-r1.md)
- [Original submitted fixtures](C:/Users/Leo/Documents/Codex/2026-10-08/based-on-these-specs-generate-images/remilo-r10-data-help/submission-fixtures-r1.json)

These absolute links locate this owner's local artifacts; a separate checkout
does not acquire those files by cloning the repository. Original generation
inputs, prompts, image provenance and r1 evidence must remain historical records,
rather than being rewritten to imply the first images already used r2.

After asking whether the preview rows were backup files or per-event selection,
the owner selected the intended behavior:

> Restore the whole backup with clear handling of existing reminders would be the expected behavior.
>
> Adjust all the related documentation and UI examples accordingly.

[A34](../design/r10-restore-whole-backup-intake.json) records that exact request.
It accepts whole-backup behavior and authorizes related clarity corrections;
it does not approve every generated pixel, unrelated R10 proposal, production
implementation or native/device acceptance. The revised examples await review.

## Clarified presentation

[The current specification](../design/r10-data-help-specification.md) and
[fixtures](../design/r10-data-help-fixtures.json) are revision 2. One chosen backup
contains the previewed reminder/whole-family entries and lists. All new entries
and lists, including empty lists and entries beyond the visible preview page,
participate automatically when Restore is confirmed. Conflict matching uses stored
identity, not title text. Editing a preview choice performs no import.

- The idle introduction explicitly says one backup is restored, new reminders/
  lists are automatic and existing reminders stay unchanged.
- Preview context says **Reminders from the selected backup**. Its helper starts
  **When you restore…**, keeping the operation prospective rather than implying
  previewing has already imported content.
- Existing entries say **Already on this device** and expose two mutually
  exclusive choices: **Keep existing** / **Add a separate copy**. The first is
  initially selected. Both leave the original unchanged; only the second adds the
  backup version under a new identity. Radio groups are the r2 presentation
  resolution for image/component review, not an additional native restore mode.
- New rows say **New entry · Included automatically**, with no inclusion control.
  The native preview lacks a typed one-off/family field; this generic label avoids
  inventing one. Repeating titles/scope retain whole-family semantics.
- Busy/unconfirmed rows retain their identity label and readable chosen result
  instead of editable radio groups or switches. The same frozen backup, copy IDs
  and operation ID are retried; nothing was imported cannot be claimed after an
  uncertain import. Clear result/invalid-file/legacy-timing examples retain the
  same whole-backup meaning.

The example explicitly adds a dentist conflict copy and keeps the existing Team
standup family. The fixture's **initial default** copy set is empty; its separately
named **explicitly chosen example** set contains the dentist identity. Expected
outcomes are separately keyed: the initial default adds four units/preserves two;
the explicitly chosen example adds five units/preserves one. R10-10 continues to
show the latter native-result fixture. This clarifies presentation while keeping list
identity/name rules, whole-family copies, elapsed-alert silence, weak preview
timing, receipt-only acknowledgements and bridge/process-lifetime gaps intact.

All eight R3 Light/Dark references remain the style authority. No appearance,
backup format, query, runtime, schema, milestone ownership or backlog state changes.
Generated geometry/colors remain approximate and require the existing discrepancy
notes and actual component checks.

## Verification and limits

Static documentation checks passed for fourteen unique states, all eight exact R3
reference hashes, the two preview fixtures, initial/default versus explicitly
chosen copy identities, automatic new rows without controls, radio-choice labels,
frozen-job sameness, honest invalid/fresh/receipt-only result copy and existing
timing warnings. **417 local Markdown links**, JSON syntax/authority paths and the
original external r1 brief hashes were verified. `git diff --check` and the scope
review passed: twelve existing documentation files changed and three documentation
records were added. Original A32/r1 evidence, R3–R8 accepted reference bundles and
runtime source files remain unchanged. The static validator/report is local
tooling beside the external review bundle, outside Git; it is not app verification.

The external gallery owns the revised image inventory, prompts/provenance and
per-image generation discrepancies. A synthetic screenshot is not a rendered
React Native/Compose component or proof of contrast, target sizes, TalkBack,
real file import, share delivery, alarm audibility or process recovery. Those
checks remain in the existing implementation/consolidated acceptance scope.
