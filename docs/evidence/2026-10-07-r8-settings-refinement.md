# R8 Settings, Appearance, permissions and Test alarm refinement

Recorded 7 October 2026 against starting commit
`78815751391dcf13d0661fc24f857a0930ae4e01`. Documentation/reference review only.

## Scope and outputs

[A28 intake](../design/r8-settings-appearance-intake.json) records the owner's
“continue” annotation on the recommended Settings/Appearance/permissions/Test
alarm family and requirement to use all eight R3 images for style while keeping
the established UX. The [R8 specification](../design/r8-settings-appearance-specification.md)
and [thirteen prospective captures](../design/r8-settings-appearance-fixtures.json)
remain proposals, not owner acceptance of a new design or production execution.
The remaining-screen map and relevant P04A/P09/design entry points link the draft.
Implementation ownership, prior acceptance records and live backlog stay intact.

## Actual review

- Read required product/backlog/architecture/verification and current approved
  direction; inspected all eight R3 Light/Dark PNGs through `view_image`.
- Three independent read-only audits inspected settings/native actions,
  appearance/preferences/storage/plans and the complete R3 visual set.
- Source review distinguishes existing auto-save/brightness/preferences/preview/
  test/permission UX from proposed Appearance routing/global scene persistence,
  clearer contextual feedback and returned-test View navigation.
- Recorded live-global Snooze scope versus new-reminder sound/vibration defaults;
  separate app/Alarm/Notification channel requirements; full-screen Limited as
  presentation; actual native preview/fallback and five-second bound.
- Recorded the existing Test API's missing client retry identity. A lost reply
  must not be followed by a fresh test disguised as Retry. This task documents
  the gap; it does not fix or claim that command implemented.
- Checked current official Android special-permission/full-screen/channel guidance
  and accessibility target/text-scaling guidance. Sources are linked in R8;
  product layout choices and unimplemented contracts are labeled separately.

## Static verification

- Local Node validation passed: thirteen unique candidates, eight exact R3
  hashes, matching theme/appearance mappings and one-to-one first-eight coverage.
  Checked 15-second test targets, distinct native result states, mixed-channel
  readiness, fallback versus selection, invalid Snooze and uncommitted time picker.
- All **43 accepted/associated R3–R7 PNGs** and five historical acceptance JSON
  files remained byte-identical to starting HEAD. Validated **297 current local
  Markdown links** in the changed documents plus seven authority/intake paths.
- Two follow-up read-only audits found no consequential behavior or appearance
  contradiction. Corrected wording about latest-value preference coalescing,
  same-job uncertainty versus a confirmed stale-rejection rebase, and the proposed
  Appearance route. Added device Dark as R8-12's ambient time-picker assumption.
- `git diff --check` passed. Changes are documentation only; app/native/module
  source and `docs/backlog.md` are unchanged. The small validator/report is local
  tooling in the Codex visualization workspace, outside Git.

These are source/reference/document/fixture checks, not running product behavior.

## Limits and next checkpoint

No new image generation, browser/RN/Compose rendering, app/native edits, builds,
tests, phone actions, measured token contrast, real IME/TalkBack or physical alarm
observations occurred. R8's manually chosen themes and fixed review clock do not
establish automatic time boundaries, defaults, migrations or safe appearance
storage. No new exact production artwork/tokens or accepted renders are claimed.

The next visual review can generate the thirteen proposed readable captures from
their matching R3 references, with actual generation discrepancies placed beside
each selected image. Actual fixed/automatic appearance and safe Test retry need
their relevant implementation contracts/checkpoints. Completed/Trash/Activity
are the next unrefined family after this Settings batch.
