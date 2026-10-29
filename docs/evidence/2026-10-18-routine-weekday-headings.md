# Routine weekday headings — 18 October 2026

The owner approved 每周安排 for weekday-grouped content, 日期与时间 for the
lower timing settings, and 步骤 counts instead of 动作 in the weekday rows.

The production builder selects a dedicated Weekly plan / 每周安排 heading in
ByWeekday mode. Each weekday uses the existing localized step-count message in
both General and Exercise presets. Shared sequences retain their content heading.
The timing heading is Date and time / 日期与时间 in both modes. Existing connected
components, themes, spacing, targets, drafts and native actions are unchanged.
The shared catalog and generated TypeScript/Kotlin/Android resources are aligned.

## Host verification

- Catalog generation/parity: 2,230 English/Simplified Chinese pairs.
- `npm run verify -- --json`: localization, design/preserved-reference checks,
  TypeScript, ESLint and 327 shared tests in 40 files passed. The frozen R8 gallery
  retains its existing lint warning. Four tooling fixture-clone tests initially
  failed because the Windows sandbox denied Git's MSYS named-object creation.
- `npm run test:tooling`, rerun with the required host permissions: all 104 passed.
  No test or assertion was changed.
- Isolated production-component preview: eight atmosphere/brightness pairs at
  100% and 200% text, 390/320 dp widths; both presets checked in each case.
  All weekday headings/counts and the lower timing heading matched. Save remained
  at least 56 dp and within the viewport. Authored Weekly workout/Bird-dog content
  was preserved. English and new shared-mode headings also passed smoke checks.
  Thirty-two captures were produced, with no browser script errors; representative
  light/normal and dark/200% images were visually inspected.

Private proof: `verification/local/weekly-heading-verify.log`,
`verification/local/weekly-heading-tooling.log` and
`verification/local/weekly-heading/summary.json` plus its adjacent PNGs.

This bounded label/grouping change did not rerun native tests, release assembly
or signed-phone acceptance. No new APK, installation or distribution is claimed.
Existing consolidated phone IME/TalkBack/font gates remain applicable; browser
fixtures are not Android-device evidence. Prior release evidence is unchanged.
