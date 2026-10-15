# Calendar disclosure alignment — 14 October 2026

Source: changes to `src/ui/components.tsx` and the current Calendar design contract
on top of `1941e4f`, recorded together with this evidence in the CAL-06 commit.
The unrelated `.vscode/settings.json` edit was preserved.

## Change and inspection

Connected disclosures previously used a compact bare-icon header, 4dp horizontal
padding and a bottom rule, unlike adjacent settings rows. Hiding the summary on
expansion also changed the header height and vertically recentered its icons.

Connected disclosures now use the surrounding row's 16dp inset and shared gap, 40dp
neutral icon container, 20dp trailing chevron and at least 56dp header target.
Supplied summaries remain visible in both states. Expanded content has a 16dp
inset, the standalone bottom rule is omitted, and press/focus treatment uses the
connected corners. State, forced opening and synchronization behavior are retained.
Standalone disclosures keep their existing compact layout. Explicit web expanded
state supplements the existing native accessibility state.

## Actual host checks

- `npm run verify`: passed TypeScript, design verification, ESLint, 34 source test
  files / 271 tests and 91 tooling tests. The existing unused-variable warning in
  the frozen R8 gallery remains; no ESLint errors.
- The first sandboxed run passed source checks but failed four local Git-clone
  tooling fixtures because Git's MSYS subprocess could not create a named object.
  A rerun with the required host access passed all 91 tooling tests, without
  changing or weakening the tests. Its log is ignored local evidence at
  `verification/local/calendar-disclosure-verify.log`.
- `git diff --check`: passed.

## Rendering and physical limits

The memory-only preview server on port 8096 initially hit browser deadlines during
its cold bundle. After compilation, the updated Calendar overview rendered in
Evening Dark at the observed 1280 x 720 viewport. Its Sync controls header matched
the surrounding rows' icon container and text column; expanded actions remained
inside the parent surface and the focused header followed its connected corners.

Read-only DOM measurements across collapsed, expanded and collapsed again found
the same 70px header height and leading-icon origin (16px, 15px) relative to the
header in all three states. The 40px icon container and 20px chevron retained their
positions. The accessible expanded attribute changed false -> true -> false,
with Expand/Collapse exposed in the browser accessibility tree.

Sky Light at fixture 200% text also rendered the header, revealed buttons and
wrapping support text. Its collapsed/expanded header stayed 112px high with the
same icon origin (16px, 36px). Both reviewed appearances showed loaded glyphs,
the shared neutral icon container and consistent alignment with adjacent rows.

The attempted phone viewport override did not change the actual observed viewport;
no narrow-phone rendering is claimed. A screenshot from the earlier 8095 preview
was context only. The full eight-pair matrix, narrow layout, large text and signed
Android touch/TalkBack acceptance remain separate; the large-text observation
above covers only Sky Light at the observed desktop viewport. No Android assembly,
installation, distribution, live Google action or new physical acceptance was
performed. Existing P4-D/P4-E/G4 acceptance requirements are retained.
