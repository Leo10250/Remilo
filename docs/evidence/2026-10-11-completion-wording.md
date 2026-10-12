# Explicit completion wording — 11 October 2026

Source base: `8b79789`, branch `UX-Improvement`. The owner requested replacing
ambiguous Done buttons with specific completion wording consistently across
screens. Single completion now reads Mark as done; captured group completion
reads Mark all as done (N).

Changed surfaces: Agenda and list-scoped overflow menus, shared card checkbox
spoken labels/custom accessibility actions and revealed swipe text, Details'
persistent action including ringing Details, Agenda's captured alarm-session
action, native single/member/group alarm controls and spoken descriptions, and
private/public single/group ringing and ordinary notification actions. Shared
swipe text wraps within its existing action area. Existing growing app/native
buttons retain their target minimums. Completed/history labels, Reopen, Restore,
Done selecting and the system keyboard's Done action keep their specific meaning.

Native command names, notification PendingIntent purposes, operation IDs, captured
member guards, completion history, timing, privacy and persistence are untouched.
Existing native notification-title expectations change only to the new wording;
their action execution, repeated-delivery, group, public-privacy and history
assertions remain intact. No new copy-mirroring tests are introduced.

`node scripts/verify.mjs` (the npm verify entry point) passed the design/evidence
audit, TypeScript, ESLint, **216 source tests in 27 suites** and **82 tooling
tests**. The pre-existing reference-gallery unused-variable warning remains.
The committed Gradle wrapper ran `:remilo-alarm:testDebugUnitTest` and
`:remilo-alarm:lintDebug` offline with the repository toolchain: **222 native
tests in 22 suites**, zero failures/errors/skips, and module lint passed; BUILD
SUCCESSFUL in 2 minutes 18 seconds. Diff whitespace checks passed. A targeted
source audit found no remaining generic Done work-completion label in app/native
runtime surfaces; remaining Done references are internal identities or Done
selecting.

The memory-only fixture preview was inspected at 360×800. Sky Light Details
showed the full Mark as done label in its persistent footer. Night Dark at 200%
text showed readable wrapped Mark all as done (2), matching row-checkbox spoken
labels and the home-card overflow's Mark as done action. These are fixture
presentation observations, not Android or alarm-delivery evidence. The full
eight-pair/landscape matrix and swipe/native-device wrapping were not observed in
this focused copy pass.

No updated signed APK has been built or installed as part of this wording change. Native alarm/notification
wrapping and TalkBack on an updated signed build remain device observations,
separate from source audit and host checks.
