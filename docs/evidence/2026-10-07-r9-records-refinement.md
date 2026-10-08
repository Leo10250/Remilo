# R9 Completed, Trash and Activity refinement

Recorded 7 October 2026 against starting commit
`316a1267ddebdc8540a9043537cc8f8c374cde27`. Documentation/reference review only.

## Scope and outputs

[A31 intake](../design/r9-completed-trash-activity-intake.json) records the owner's
continuation annotation and all-four-theme/all-eight-image style requirement.
The [R9 specification](../design/r9-completed-trash-activity-specification.md)
and [fourteen prospective captures](../design/r9-completed-trash-activity-fixtures.json)
are proposed layouts/fixtures, not newly generated or accepted templates.
Entry points and P05/P07 link the draft; Data/Help is the next unrefined family.
No implementation ownership, dependency or backlog status is changed.

## Actual review

- Read product/backlog/architecture/verification, current approved corrections,
  R7/R8 and P05/P07; inspected every R3 Light/Dark PNG through `view_image`.
- Three independent source/visual audits reviewed native collection/actions,
  routing/Activity and all eight R3 references. Two follow-up reviews checked the
  new specification and fixtures for native/visual contradictions.
- Kept native title/notes/membership filtering before pagination and latest
  relevant Done/Skip/Delete order. Collection rows show status only: their
  ordering fallback has no displayed action-time provenance. Details/Activity
  use actual history and never invent Create/delivery/family audit entries.
- Recorded skipped Reopen retaining skipped, missing unconfirmed collection
  command retention, current Browse collection roots and absent focused
  paused-family Restore coverage as implementation gaps, rather than claims of
  implemented fixes. Restore still retains completion/skip and never replays
  elapsed alerts; future repeat exceptions can remain independently eligible.
- Follow-up review corrected fixture delivery states to native Completed/Deleted,
  clarified each independent dataset and the alternative unfinished snapshot,
  and specified outlined Reopen versus filled Restore detail footers.

## Static verification

- Local Node validation passed for fourteen unique candidates, eight exact R3
  hashes/mappings and one-to-one first-eight appearance coverage. Eight collection
  fixtures passed native-like membership/search/order assertions; Activity order,
  recorded target dates, terminal flags, empty history, independent snapshots,
  footer variants and captured/stale action fixture constraints were checked.
- All **56 accepted/associated R3–R8 PNGs**, the one rejected R6 PNG and six
  historical acceptance JSON files stayed byte-identical to starting HEAD.
  Validated **358 current local Markdown links** in the fourteen changed documents
  plus seven authority/intake paths. App/native/module sources and backlog are
  unchanged.
- `git diff --check` and trailing-whitespace checks passed. The validator/report
  is local tooling in the Codex visualization workspace, outside Git. Its fixture
  assertions model expected inputs; they do not execute Kotlin or prove safe
  runtime query/action behavior.

## Limits and next checkpoint

No new image generation, browser/RN/Compose render, app/native edits, build,
runtime tests, device actions, measured token contrast or real IME/TalkBack/physical
alarm observations occurred. The manually selected themes do not establish
automatic periods/defaults/migrations. A31 authorizes refinement, not new draft
acceptance, image generation or P05/P07 execution.

The next image review can use the fourteen specified states, one readable screen
per image, following every matching R3 role pair. Generation discrepancies must
be placed beside the eventual selected images. Actual components/native fixes and
the consolidated physical acceptance remain separate checkpoints.
