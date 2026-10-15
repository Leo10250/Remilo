# Calendar attention and scoped check observations — 14 October 2026

## Scope and source

Application source is `cabebc6` (native outcomes), `b4918bb` (presentation,
action controller and fixtures) and `382ded5` (empty-source access recovery and
stale-failure fencing), extending `7418d2f` with scoped native sync requests,
durable checked/changed reporting, shared action recovery, semantic status and
reminder-first Calendar hierarchy. Source commits and the final local artifact
are attributed below. The final assembly runs against `382ded5`, with only
documentation and the unrelated `.vscode/settings.json` edit dirty.
No installation, distribution or live Google operation accompanies this work.
CE/DP/backup remain **12/6/4**; no dependency or artwork was added.

## Automated evidence

The final shared command is `npm run verify`, with type checking, lint, design
contracts, **34 source files / 271 tests** and **91 tooling tests** passing.
The existing frozen gallery unused-variable warning remains. Approved artwork
resolution observations remain recorded without regenerating pixels.

New native tests exercise immutable capture/reuse, no-change versus real-change
sets, empty versus unchecked sources, partial/offline results, request scope,
recreation, newer dirty content, account/Purge fencing, paused work, non-mutating
saved reads, full aggregate severity beyond a review page, same-clock ordering and
durable exponential retry deadlines. Existing P4-B/C/D/E and alarm tests are
retained. Shared tests cover lost acknowledgement, exact-command recovery,
simultaneous presses, scoped results, account fences, outcome tone, recorded field
labels and intentional Pause versus uncertain-write inspection.

Empty managed calendars retain an actionable setup issue when authorization
fails. Account revision and authorization-epoch guards prevent a late failure
from changing a replacement connection/binding. This uses the existing native
access-recovery transition, including its permission fence.

Intermediate native runs exposed a test-clock declaration error and a compilation
attempt that read a late coverage change between source phases. The test clock
was corrected, application edits were committed, and the full final commands
were rerun against stable source. No behavioral test was removed or weakened.

Final command logs are ignored local evidence:
`verification/local/calendar-refinement-verify-final.log` and
`verification/local/calendar-refinement-android-final.log`.

## Production-component observations

The isolated fixture server used `scripts/preview-ui.mjs --port 8095`. Calendar
state is synthetic and memory-only; it cannot authorize Google, write remote
events or schedule Android alarms. Browser captures are under
`verification/local/calendar-refinement/`.
Captures came from the CAL-05 working tree over `7418d2f`, before the final UI
commit. Later gutter, review-timing, wording, ordering and announcement changes
were host-checked but were not recaptured; these images are focused development
observations, not final-source appearance acceptance.

Observed in the fixture browser:

- The compact management page shows the larger title and strong local alarm
  value, neutral Automatic sync on, one freshness line, compact source, collapsed
  Sync details and lower Unlink. Optional Sync now and Recent Calendar changes
  appear when details expands.
- Pressing per-reminder Sync now produced the green check/text **No changes
  found**. No reminder-update count was fabricated. Collapsing details retained
  the explicit result and removed its optional controls from the visible page.
- The home review card is a surfaced action with attention icon, consequence,
  count, Review 1 item and chevron. Its accessibility tree exposes one named
  button. The subsequent inset correction removes a duplicated outer gutter;
  that final gutter geometry has not been recaptured.
- Loaded narrow screenshots in Sunrise Light and Evening Dark show wrapping,
  strong title/time hierarchy and optional details. The requested viewport was
  432×960; browser/web measurements are not Android dp or font-scale acceptance.

Repeated navigation/DOM/screenshot timeouts then prevented reliable inspection
of the remaining matrix, including a fresh-tab attempt. A loaded Sunrise Light
capture was recovered; loading-only frames are not counted as review. The
temporary viewport override was reset. No native acceptance is inferred.

Ordinary unimported candidates say No Remilo alert yet. Identity/adoption issues
instead ask to check the existing Calendar copy: a local reminder may already
exist, so that unresolved identity cannot prove the absence of a local alert.

## Reproducible fixture matrix

Run `npm run preview:ui -- --port 8095`. Append appearance parameters
`reviewScene=sunrise|sky|evening|night` and `reviewBrightness=light|dark`.
Each case below uses production components; URLs are relative to that local
fixture server. Interaction-only outcomes require the named button press.

| Case | Fixture route/parameters | Required observation |
|---|---|---|
| Healthy automatic, collapsed/expanded details | `/calendar-manage?id=review&reviewCalendarSync=automatic` | Local timing first; optional controls/history only inside details |
| Manual and read-only | `/calendar-manage?id=review&reviewCalendarLink=linked`; add `reviewCalendarLocal=completed` | Manual Check for changes; terminal timing, no activation of terminal work |
| Local only and queued publication | `/calendar-manage?id=review&reviewManaged=local-only` or `waiting` | Explicit disposition and truthful waiting state |
| Intentional Pause | `/calendar?reviewManaged=paused` | Neutral paused status and reviewed Resume; local alerts continue |
| No change / confirmed change | Healthy route plus `reviewSyncOutcome=NoChanges` or `Synced`; press Sync now | Green only after explicit result; checked is not changed |
| Partial/offline continuation | Add `reviewSyncOutcome=Pending&reviewCalendarOffline=1` | Pending result, no false success, leave acknowledged work safely |
| Current access / conflict / unknown write | `reviewSyncOutcome=AccessRequired|NeedsReview|Unconfirmed`; press Sync now | Specific inline recovery and red/amber text/icon |
| Native saved source problem | `/calendar?reviewManaged=access|unknown|ownership|unavailable` | Leading contextual action; no competing prerequisites |
| Unsupported/unsafe incoming event | `/calendar-reviews?reviewManaged=unsupported` or `candidate` | No Remilo alert yet; mandatory review |
| Mixed review targets | `/?reviewCalendarSync=conflict&reviewManaged=candidate` or `access` | Reminder/candidate/setup inclusion, global severity/count |
| Ready versus excluded activation | `/calendar-activate?reviewCalendarSync=activation-mixed` | Ready checkboxes; Test explanation/action, no disabled circle |
| Locked versus editable automatic choice | `/calendar-review?id=review&automatic=true&reviewCalendarSync=manual`; ordinary manual link/import review | Static included information only where fixed; supported choice remains editable |
| Local alert variants | Management route plus `reviewCalendarLocal=postponed|snoozed|none|blocked|pending|completed|skipped|ringing` | Actual next/intended/original local timing, never Google timing |
| Calendar-only history | `/activity?id=review&filter=calendar&reviewCalendarSync=automatic` | Only recorded Calendar entries; empty state and correct origin return |
| Lost acknowledgement | Add `reviewLostReply=1`, press action | Same UUID; inspect saved result before another mutation |
| Long/large/reduced/clock | Add `reviewText=long&reviewScale=2&reviewMotion=reduced&reviewClock=24`; repeat with 12-hour default | Wrap, no obscured footer, supported selection and announcements |

| Appearance pair | Observed in this run |
|---|---|
| Sunrise Light | Loaded management and home attention; capture available |
| Sunrise Dark | Unobserved after browser timeouts |
| Sky Light | Unobserved after browser timeouts |
| Sky Dark | Fresh-tab access fixture did not produce an inspectable result |
| Evening Light | Unobserved after browser timeouts |
| Evening Dark | Loaded management, details interaction and explicit no-change result |
| Night Light | Unobserved after browser timeouts |
| Night Dark | Unobserved after browser timeouts |

Landscape, final review-row timing, 200% text, long English/Chinese, reduced motion,
both clock formats, all semantic contrasts and the remaining state/pair crosses
remain unobserved in this refinement run. Existing older observations describe
their own source; they do not close this matrix. Real authorization, TalkBack,
Android Back/IME, native pickers and live Google remain signed-device requirements
in the [consolidated checklist](../device-acceptance.md#calendar-attention-and-scoped-checks-cal-05).
P4-D/P4-E/G4 physical acceptance is preserved.

## Final Android and artifact attribution

Final `npm run verify:android` passed after the final shared command. Native unit
reports contain **37 suites / 448 tests**, zero failures, errors or skipped tests.
The new request/recovery suite contains **16 tests**. Module lint, application
release lint and signed release assembly completed: **BUILD SUCCESSFUL in 3m 52s**.
Existing SDK XML, native deprecation/cast and Gradle deprecation warnings remain.

The repository `inspectApk` helper independently verified the preserved artifact:

- Local copy: `verification/local/calendar-refinement-remilo-0.4.0-382ded5-arm64.apk`
- Source: application source at `382ded5`; only documentation and the preserved
  editor preference were dirty during final verification/assembly.
- Package/version: `com.remilo.app` **0.4.0 (4)**, ARM64, min SDK 34, target SDK 36.
- Release configuration: bundled JavaScript, non-debuggable, signature verified.
- Size: **87,620,027 bytes**.
- APK SHA-256: `3402965837acfa1cb25dd378d2fe82c2c3adb7e2b0f11f42a26983d2992afbfd`.
- Signer certificate SHA-256: `880b7bc2e35722a72f9170c863945e0a65e3cf4c9f142aedf9ab6837c1e43556`.
- Inspection metadata: `verification/local/calendar-refinement-artifact.json`.

The following documentation commit changes no application source. This local
artifact was not installed or distributed. Host results do not establish live
Google behavior, device accessibility or alarm-delivery acceptance.
