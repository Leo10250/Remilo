# Calendar setup and timed publication diagnosis — 11 October 2026

## Observations and cause

Source base: `5ee5622c901d8ebc7e05c171a8f253d582d9fa57`, branch
`UX-Improvement`. The owner reported account connection with no calendar selected,
the generic review load error, then Failed timed publication after destination
selection. The owner subsequently confirmed an All day publication succeeded.
These observations do not identify an APK hash or establish the full P4-A gate.

Native preview requires both a connected account and an owned destination.
The old review passed its typed NEEDS_CONNECTION error into the generic
QueryState message, hiding the unfinished setup. The compact Agenda menu follows
the approved Edit/Postpone/Done/Move to Trash contract; publishing is available
from Details → More, independently of OAuth permissions.

Timed payloads used OffsetDateTime.toString(), which omits zero seconds. A
12:00 task could send `2026-10-12T12:00-07:00`; Calendar requires RFC 3339,
including seconds. An added exact-minute native regression failed on that
formatter before the repair. All day events send date-only values and bypass
this defect. This source reproduction and the owner's timed/All day contrast
strongly support the diagnosis; the phone's actual HTTP status was not collected.

References: [Calendar event fields](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert),
[RFC 3339 section 5.6](https://www.rfc-editor.org/rfc/rfc3339#section-5.6),
[Java 17 OffsetDateTime.toString](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/time/OffsetDateTime.html#toString()).

## Repair

Settings exposes numbered account and calendar steps, retaining the unselected
destination before connection. A connected account without a calendar has a
warning and prominent Choose publishing calendar action. Review explains this
prerequisite directly. Owned-list fixtures model connection without silently
selecting a destination; the isolation test explicitly selects before publication.

Timed event fields now use UTC Instant encoding with seconds and preserve their
instants, milliseconds and named zone. The HTTPS boundary also normalizes saved
legacy timestamps so the original job can be deliberately retried. It leaves the
durable payload, operation, fingerprint, account, destination and remote event ID
intact. Recovery retains exact-ID lookup before insert. All day date/exclusive-end
mapping and Calendar reminder suppression are unchanged. HTTP 400 has a distinct
safe rejection message, without retaining or exposing server response text.

## Verification boundaries

The exact-minute regression initially failed as expected. The focused shared
Calendar suite passed 5 tests and TypeScript passed. An initial native test compile exposed Android
JSONObject's lack of similar(); the test now compares decoded JSON values. The
initial tooling run exposed a fixture test's assumed auto-selection; that test
now requires explicit selection and retains its network-isolation assertions.

Final shared verification (`node scripts/verify.mjs`, the npm verify entry point)
passed the design/evidence audit, TypeScript, ESLint, **216 tests in 27 source
suites**, and **82 tooling tests**. The pre-existing reference-gallery unused
variable warning remains. After the final UI ordering adjustment, TypeScript,
focused Calendar-page lint and diff whitespace checks passed again.

The committed Gradle wrapper ran `:remilo-alarm:testDebugUnitTest` and
`:remilo-alarm:lintDebug` offline using the repository-selected toolchain.
The final run passed **222 native tests in 22 suites**, zero failures/errors/skips,
and native module lint; BUILD SUCCESSFUL in 56 seconds. New transport tests
capture the actual HTTP request body through an injected synthetic connection,
checking legacy encoding, original destination/identity/private fields, fractional
instants and both DST-fold offsets, unchanged all-day exclusive dates/reminder
suppression, and bounded HTTP 400 errors without private response text.

The isolated preview was inspected at 360×800 in Sky Light. The missing-calendar
warning and Choose publishing calendar action appear before the numbered setup
rows. The action opened owned selection, choosing its synthetic calendar updated
the destination and removed the unfinished-setup action. The review route showed
the specific two-prerequisite message and Calendar settings action. Night Dark
at 200% text kept the warning and growing action readable in a scrollable page.
These are memory-only fixture observations, not OAuth, remote publishing or
Android-device acceptance. The full eight-pair/landscape matrix was not performed
for this focused correction.

Device discovery could not connect to ADB under the sandbox, so no phone logs or
captures were collected. No Google OAuth action or remote write was performed by
the agent. No updated signed APK was built or installed. Next device observation:
after installing an authorized updated signed build, retry the existing timed
publication and inspect its original destination for exactly one matching event,
correct range/zone and disabled Calendar reminders. Check new timed and All day
publication separately. Local alarm reliability remains its own evidence gate.
