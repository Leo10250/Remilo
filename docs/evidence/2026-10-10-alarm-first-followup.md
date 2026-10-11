# Alarm-first editor and short-menu follow-up — 10 October 2026

The owner approved Title → Time → alert type, optional Calendar event details,
and divider-free short menus after discussion of Clock flows and Material 3
Expressive grouping. This amends the [initial UX pass](2026-10-10-ux-refinement.md);
the maintained [contract](../design/current/ux-refinement.md) records final behavior.
Status belongs only to [UX-19 in backlog](../backlog.md).

## Behavior

The editor's one primary Date/Time control precedes the visible mode choices.
It reads Alarm time, Notification time or Scheduled for; Title and its existing
focus/keyboard handoff remain first. Date and Time use independent native pickers,
sharing a row when space permits and stacking when necessary. Spoken picker names
distinguish Alarm/Notification/Scheduled fields from Event fields.

Ordinary linked reminders move their default event/due schedule with the primary
alert. Existing non-default ranges, independent fields, offsets, all-day events
and stored publication context preserve event/due instants; changing the alert
makes it independent. An unavailable stored-publication read conservatively
preserves a coincident event without blocking editing. This consumes the existing
credential-protected publication query, not a new Calendar/network API.

Calendar event starts collapsed and summarizes configured timing. Explicit start,
end or All day event edits preserve the selected alarm/notification. An All day
event keeps a visible alarm clock; No alert retains its scheduled date boundary.
Existing flags represent independence, including coincident values; there is no
new durable field or migration. Details promotes Event only for existing publication
context and otherwise retains the full range in Schedule details. Independent Due,
native target eligibility and postponement/overdue semantics remain intact.

Agenda, Completed and Trash short action sheets have consistent rows without
dividers. Trash remains last where applicable; permanent deletion retains its
irreversible description and destructive confirmation, with existing guards/Undo.

No artwork, dependencies, native commands/storage, backup versions, publication
mutation behavior or navigation roots changed. Calendar troubleshooting remains
deferred. Current contracts, TD-03, product behavior and U28/U30 were amended.

## Checks and build identity

- Shared verification passed **2026-10-11T03:17:32.607Z** (10 October local):
  design/evidence audit, TypeScript, lint, **192 active source tests in 22 files**
  and **82 controlled tooling tests**. The only lint warning is the existing
  unused variable in the frozen R8 gallery generator.
- New domain checks cover primary schedule movement, non-default and independent
  event/Due preservation, coincident publication context, later-fold instants,
  explicit Calendar edits, All day/date round trips, No alert boundaries, no-op
  identity and conversion failure. The focused editor/presentation run passed
  **67 tests** before integrated verification.
- Android verification passed **2026-10-11T03:21:04.585Z**: module lint, app release
  lint and signed release assembly. Gradle reported **BUILD SUCCESSFUL in 2m 26s**,
  31 executed/1001 up-to-date tasks. The unchanged native unit-test task was
  **UP-TO-DATE**; its reports contain **216 tests in 21 suites**, zero failures/errors.
- Final application source is **b79c51ca40f3b3a8610e6851089cb77e8a163e36**. The
  checkout was clean at that revision throughout Android assembly. Later evidence
  edits do not alter the built application.
- Artifact: `android/app/build/outputs/apk/release/app-release.apk`, release ARM64,
  signed, bundled JavaScript, non-debuggable; **com.remilo.app 0.4.0 / code 4**,
  minimum SDK 34, target SDK 36.
- APK SHA-256:
  `ebddf1016a0c19967019610fc73cd9dcc67b7aebd1c35536a5449a4d574cde67`.
- Existing signer SHA-256:
  `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.

Separate design verification after final evidence edits passed; protected
reference records/artwork and the previously recorded master-resolution limitation
remain unchanged. No APK installation, launch or distribution occurred.

## Actual fixture observations and limits

In the isolated in-memory production-component preview, Sky Light at 360×800 and
412×915 showed Title before timing, timing before mode, one main control, and
collapsed Calendar details. Date/Time stacked at the narrow usable width and
shared a row at 412. Alarm → Notification → No alert → Alarm changed labels in
place and retained the selected ordinary date/time. The Calendar All day switch
preserved the alert clock, and switching back retained it with a collapsed event
summary. One Save tap returned to Agenda with the configured alert visible.

Agenda, Completed and Trash menus were inspected and captured with no divider;
permanent deletion retained Cannot be undone. DOM names distinguished alarm and
event pickers. These are fixture observations, not Android IME/TalkBack acceptance.

The browser surface stalled when navigating to the Night Dark/200%/reduced-motion
editor, then could not provide a fresh DOM snapshot or complete cleanup. No passing
result is claimed for that configuration or landscape. The preview server was
stopped. Private screenshots and final shared/Android logs remain under ignored
`verification/local/alarm-first-followup/`.

U28/U30 and the broader consolidated device/render observations remain pending
under the owner's deferred-testing arrangement. Native picker Cancel, keyboard
handoff, composition, TalkBack and actual alarm delivery require the identified
signed device run. Prior evidence is preserved with its original scope.
