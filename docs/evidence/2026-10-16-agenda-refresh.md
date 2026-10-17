# Agenda refresh indicator

The owner reported a spinner rapidly appearing and disappearing on Agenda.
Source inspection started at `e5d35c3`; no installed-build attribution or new
phone observation was made. Task status belongs in the backlog.

Agenda passed `reminders.isRefetching` directly to SectionList's `refreshing` prop.
Root query invalidation runs after native changes, app foregrounding and every
active minute for date/status presentation. Consequently a background local
reread could activate the pull-to-refresh control even without a gesture. This
source mechanism matches the reported top-spinner flash; it does not identify
the location of the owner's observed spinner or prove Google work was running.

The version-matched [React Native 0.86 RefreshControl documentation](https://reactnative.dev/docs/0.86/refreshcontrol)
defines refreshing as a controlled prop set by onRefresh.
[TanStack's background indicator documentation](https://tanstack.com/query/v5/docs/framework/react/guides/background-fetching-indicators)
distinguishes background fetching from initial loading.

Agenda now owns its manual refresh indicator separately. A gesture activates it
before reconciliation, awaits reconciliation and query invalidation, and clears
it in finally. A synchronous ref rejects overlapping gestures. Existing error
feedback remains; cached background updates, date grouping, native authority,
first-load and pagination feedback retain their behavior. The same shared Agenda
component covers list-scoped Agenda. No timer, native scheduling or Calendar
sync behavior changed, and no new strings, graphics or styling were introduced.

`npm run verify` passed: 2,126 English/Chinese messages, design/preserved-reference
checks, TypeScript, ESLint, 313 shared tests and 97 tooling tests. ESLint retains
the existing frozen R8 gallery unused-variable warning. The original approved
scene master-resolution limitations remain unchanged. Private output is
`verification/local/agenda-refresh-verify.log`. Post-documentation design checks
and `git diff --check` also pass.

This is a presentation-only change; no new native tests or signed APK were built
for it. The preceding Calendar repair's APK does not contain this Agenda change.
No app was installed or distributed. Signed-phone observation must still check
an idle minute, native updates/foregrounding, deliberate and repeated pull,
cached-data errors, first loading and pagination. A bottom pagination spinner
has a separate trigger and has not been diagnosed from this report.
