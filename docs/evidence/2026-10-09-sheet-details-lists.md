# Sheet colors, connected Details and list glyphs — 9 October 2026

## Request and cause

The owner reported blank Agenda/Lists header More sheets in Night Light, missing
Details seams and insufficient visual identification of library lists. This
follow-up supersedes the earlier list-icon omission and extends connected grouping
to Details; it does not change accepted reference pixels.

AtmosphericHeader overrides ink/muted for text on scenic artwork. RootMore renders
its Sheet within that React subtree. Modal retains React context, so the sheet
inherited header white foregrounds over Night Light's white surface. Other Light
headers happened to use dark foregrounds; Dark surfaces happened to contrast with
white. Completed/Trash menus were outside that override. The underlying problem
was the shared sheet boundary, rather than a missing action or a Night-only palette.

## Changes and references

- Sheet restores the foundation palette for its own title and all content/footer,
  resets scenic-control context as well as connected-row/scroll context, and keeps
  inherited scale, reduced motion, appearance hold and modal behavior.
- Details opts into connected Schedule rows: When, conditional Due, Alert mode,
  conditional Next alert, List and conditional Notes. Stable keys preserve retained
  rows; timing support stays in the row and zone guidance in the footer. Repeat
  uses a separate connected singleton with query recovery/guidance in its footer.
  The editor's read-only Schedule preview retains its existing panel. InformationRow
  uses shared corner/focus treatment while retaining label/value anatomy.
- Library No list and named lists, plus management rows, use the existing neutral
  24 dp checklist glyph in the shared 40 dp soft container. Overdue support remains
  within its entry; navigation and the 48 dp More button remain separate targets.
  No icon picker or name/category classifier applies.
- Current contracts and TD-03 distinguish this later owner decision from the
  historical icon-free correction. Filter radio choices and backup list previews
  retain their existing presentation.

Material's [official segmented-list samples](https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/samples/src/main/java/androidx/compose/material3/samples/ListSamples.kt)
combine leading icons, index-dependent shapes and segmented gaps, and separately
demonstrate independently clickable trailing actions. Remilo reuses that anatomy
with its existing neutral glyph/container and established 2 dp seams, 16/4 dp
corners and typography. No new token, dependency, engine API, storage or artwork
change applies.

## Isolated fixture observations

Agenda and Lists More sheets were captured in all eight atmosphere/brightness
pairs at 412×915. Both use identical surface/foreground roles within each pair;
Settings and Manage lists remain visible and functional. The Night Light sheet
measures white surface with `rgb(23,36,60)` foreground. In-app Appearance changes
exercise immediate saving rather than bypassing preferences. Local preview loading
delays were handled with fresh state and settled navigation, not production changes.

Details preserves When/Alert mode/Next alert/List/Notes label/value anatomy and
conditional information. DOM measurements give 2 px seams, first 16/4 px corners,
middle 4/4 px and last 4/16 px, all on the theme surface. The List row's inset 2 px
focus border has matching 4 px corners; its navigation opens Work and Back returns
to the same reminder. Counts and independent More targets remain in library rows.

Completed and Trash More sheets retain readable Night Light actions. Library and
management share the checklist/container treatment, including No list. At 320×915
with 200% fixture text, long bilingual names and notes grow/wrap and scroll; measured
document width stays 320 px and the independently focused More target stays 48×48 px.
Header More and long-name list-action sheets retain their actions. Large-text Details
shows independent Due without a Next alert for No alert; all-day No alert shows
When/All day and end-of-day support without extra Due/Next alert rows. An ordinary
repeat with no Notes gives List the last 4/16 px corners and matching focus outline,
with Repeat as a separate singleton. These are web fixtures, not system text scaling,
native focus or TalkBack acceptance.

## Host checks and artifact

Application source is the presentation diff on base commit
`1691332e1bf8c1048adeb5209bba8e1921946131`, subsequently committed for handoff. Source
was held unchanged through the following checks and assembly; subsequent edits
only record documentation/evidence. Checks used the repository's bundled Node
runtime and the same scripts as npm run verify and npm run verify:android,
in that order.

- Shared verification completed **10 October 2026 at 04:32:06.760 UTC**: design
  audit, TypeScript, lint, **374 shared tests and 81 tooling tests** passed. Lint
  retains one existing unused-variable warning in the reference gallery generator,
  with no errors. The new regression renders the actual Sheet/row components under
  a scenic white-foreground context for every atmosphere/brightness pair; title,
  supporting text, content/footer icons, surface focus, 200% text and reduced motion
  retain the expected roles.
- Android verification completed **10 October 2026 at 04:33:35.078 UTC**:
  **183 native tests in 19 suites**, zero failures/errors/skips, lint and release
  assembly passed. Existing task caching is not a fresh physical observation.
- Local artifact: `android/app/build/outputs/apk/release/app-release.apk`, signed,
  bundled JavaScript, non-debuggable ARM64, **com.remilo.app 0.4.0 / code 4**,
  minimum SDK 34 and target SDK 36, with the existing signer.
  SHA-256: `47fb75e5c6d03f507e7c93e10cebfe33f9fde2db5e4af0a4c31df857717c8a07`.

Private logs and fixture captures are under ignored
`verification/local/sheet-details-followup/`. No installation, launch, distribution
or physical result was authorized or performed. Actual Android/TalkBack checks
remain in U26 and the consolidated acceptance checklist.
