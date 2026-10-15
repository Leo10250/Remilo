# Implementation backlog (single status source)

Statuses: pending, in progress, implemented/unverified, verified, blocked.
Verified always links actual evidence. Implementation is not a passed release gate.
Owner instruction, 4 October 2026: complete offline Android development now and
consolidate physical checks for a later acceptance run. The later
[9 October owner attestation](evidence/2026-10-09-owner-g1-g3-attestation.md) accepts
G1–G3 on its identified APK; unreported individual observations remain unclaimed.
Known failures still require fixes. The owner's
[11 October P4-A sign-off](evidence/2026-10-11-owner-calendar-publishing-attestation.md)
accepts one-off Google Calendar publishing. P4-B implementation has host/build
evidence below; P4-B–P4-E signed-device acceptance and G4 remain pending.

| ID | Task | Dependency | Status | Acceptance/evidence |
|---|---|---|---|---|
| CAL-04 | Compact Calendar setup, contextual recovery and durable outcome feedback | owner 14 October approved redesign; P4-C/D/E | implemented/unverified | [263 source/91 tooling checks, 432 native tests, signed assembly and focused production fixtures](evidence/2026-10-14-calendar-ux.md); saved authorization/progress, visible source, surfaced all-day clock and grouped checkbox review; remaining visual matrix, signed-phone/live Google and G4 acceptance retained |
| UX-30 | Continuous canvas-surface browsing-header blend with stable foreground | owner 11 October approved plan; BETA-02 | implemented/unverified | [223 source/84 tooling checks, signed Android assembly and eight-pair Agenda/Settings fixtures](evidence/2026-10-11-header-transition.md); continuous native opacity, restoration, sheets, reduced motion and compact fallbacks; cached 222 native reports retained; U36 signed-device gestures/contrast/TalkBack remain |
| UX-29 | Consistent Mark as done completion wording on app/native surfaces | owner 11 October request | implemented/unverified | [216 source, 82 tooling and 222 native tests; module lint, source audit and narrow/200% fixtures](evidence/2026-10-11-completion-wording.md); single/group and spoken completion labels updated; existing action identities preserved; updated signed-device wrapping/TalkBack remains required |
| CAL-01 | Explicit account/calendar setup and RFC 3339 timed publication/retry repair | owner 11 October report; P4-A | implemented/unverified | [216 source, 82 tooling and 222 native tests; module lint and focused setup/review fixtures](evidence/2026-10-11-calendar-repair.md); exact-minute defect reproduced before repair; saved retries retain identity/content; updated signed-device timed retry remains required |
| CAL-02 | Ordered inclusive import dates, associated-event removal and reviewed Import all | owner 12 October import-browser feedback; P4-B | implemented/unverified | [236 shared/90 tooling/261 native tests, focused fixtures and identified signed ARM64 build](evidence/2026-10-12-calendar-import-ux.md); whole date range across pages, explicit per-event consent and duplicate-safe recovery; [owner checklist](device-acceptance.md) expanded; not installed/distributed; physical/live Google observations remain separate |
| CAL-03 | Calendar hierarchy, explicit management and independent Trash | owner 12 October implementation instruction; P4-B | implemented/unverified | [241 shared/91 tooling/275 native checks and identified signed ARM64 artifact](evidence/2026-10-12-calendar-management.md); schema 9 observations, local-only opening, cancellation and protected unlink/restore; focused three-pair fixtures observed; broader visual automation stalled; [consolidated owner checklist](device-acceptance.md) retains full visual/physical/live Google requirements; not installed/distributed |
| UX-21 | Alarm-first custom-repeat preview, contextual explanations and selection | approved follow-up; UX-25 | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); Schedule-only preview, native rules retained; U32 pending |
| UX-22 | Plain repeating-edit scope with authored occurrence identity | approved follow-up; UX-25 | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); Original nominal boundary and earlier reminders retained; U32 pending |
| UX-23 | Truthful save confirmation and specific captured recovery | approved follow-up; UX-25 | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); Native eligibility and exact retry identity retained; U33 pending |
| UX-24 | Required Title cue with blank Save disabled | approved follow-up | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); Quiet visual/spoken cue; U33 pending |
| UX-25 | Read-only device clock observation and explicit formatting | approved follow-up | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); No durable timing/API command changes; U34 pending |
| UX-26 | Measured navigation fit and accessible Go to sheet | approved follow-up | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); Four roots and retained origin/scroll; U35 pending |
| UX-27 | One direct Add action in genuine empty Agenda | approved follow-up | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); No CTA on constrained/stale/error results; U35 pending |
| UX-28 | Follow-up integration, render matrix and actual verification | UX-21–27 | implemented/unverified | [Follow-up host/build and fixture evidence](evidence/2026-10-10-ux-followup.md); Shared/design/Android checks and signed identity; U32–U35 pending |
| UX-20 | Icon-only collection-header Filters with active count; retain labeled Agenda action | owner-approved filter discussion; UX-16 | implemented/unverified | [192 source/82 tooling checks, signed Android assembly and cached 216 native reports](evidence/2026-10-10-filter-header-followup.md); narrow Completed headers in five pairs and Night Dark at 200% reviewed; full render matrix and U29 Android/TalkBack remain pending |
| UX-19 | Primary alarm Date/Time before mode, optional Calendar event and quiet menus | owner-approved 10 October follow-up; UX-14/15/16 | implemented/unverified | [192 source/82 tooling checks, signed Android assembly, 216 cached native reports and narrow editor/menu fixtures](evidence/2026-10-10-alarm-first-followup.md); separate/published event preservation and Calendar All day pass host checks; 200%/landscape and U28/U30 remain pending |
| UX-13 | Approved refinement contracts and shared frontend helpers | owner-approved 10 October implementation plan | implemented/unverified | [Current correction](design/current/ux-refinement.md) and [184 active source/82 tooling checks](evidence/2026-10-10-ux-refinement.md); input refs, filter/timing/context/permission helpers; physical acceptance remains separate |
| UX-14 | Editor keyboard handoff, alert control, preview and All day preservation | UX-13 | implemented/unverified | [Domain round-trip/DST/preview/review cases pass](evidence/2026-10-10-ux-refinement.md); U27/U28 Android and unfinished large-text render observations pending |
| UX-15 | Alert-first Details/cards, full spoken dates and menu cleanup | UX-13 | implemented/unverified | [Timing/date/visibility cases pass](evidence/2026-10-10-ux-refinement.md); U30 TalkBack/device and remaining render observations pending |
| UX-16 | Transactional filters, chips/reset, Completed and Trash | UX-13/15 | implemented/unverified | [Draft/equality/reset/scope/guard cases and narrow Apply/Cancel/skipped fixtures](evidence/2026-10-10-ux-refinement.md); U29 device observations pending |
| UX-17 | Settings/alarm-check, Appearance, clock shortcuts and supporting copy | UX-13 | implemented/unverified | [Permission/recovery/clock cases, eight-pair atmosphere sheets and captured recovery fixtures](evidence/2026-10-10-ux-refinement.md); U31 and remaining render observations pending |
| UX-18 | Integrated render/accessibility review and shared/design/Android verification | UX-14–17 | implemented/unverified | [Shared/design checks and signed Android assembly pass; native task reuses 216 passing reports](evidence/2026-10-10-ux-refinement.md); browser stalled during remaining matrix, U27–U31 pending; Calendar deferred; no installation/distribution |
| BETA-07 | Header More sheet theme boundary, connected Details and leading list glyphs | owner 9 October follow-up; BETA-06 | implemented/unverified | [374 shared, 81 tooling and 183 native tests; signed bundled assembly and eight-theme sheet review](evidence/2026-10-09-sheet-details-lists.md); shared Sheet restores surface colors/control context, Details uses connected rows and library/management uses the neutral checklist icon; U26 Android/TalkBack observations remain |
| BETA-06 | Connected editor, Lists and entire Settings tile grouping | owner-approved 9 October connected-group plan; BETA-05 | implemented/unverified | [374 shared, 80 tooling and 183 native tests; signed bundled assembly; eight-theme fixture and narrow 200% review](evidence/2026-10-09-connected-groups.md); 2 dp seams, 16/4 dp corners, 12 dp independent groups and scoped recovery; U25 Android/TalkBack observations remain |
| TRASH-01 | Confirmed individual and selected permanent Trash deletion | owner 9 October instruction; ALERT-03/04 | implemented/unverified | [368 shared, 183 native and 77 tooling tests; signed assembly and fixture confirmation/retry review](evidence/2026-10-09-permanent-trash.md); Expressive filled destructive action and outlined Cancel reviewed in Light/Dark and 200% text; native purge/retry/recovery/backup checks pass; Android observations remain |
| BETA-01 | Alarm Stop completion, durable pre-unlock projection and retries | owner-approved beta-fixes plan | implemented/unverified | [134 native tests and signed beta preparation](evidence/2026-10-09-beta-fixes.md); crash/Direct Boot/retry/Reopen tests pass; physical observations remain |
| BETA-02 | Four roots, built-in Repeats, alert-first Agenda and fixed-artwork browsing covers | owner-approved beta-fixes plan | implemented/unverified | [349 shared tests, native pagination and fixture geometry/navigation](evidence/2026-10-09-beta-fixes.md); Android layout/accessibility observations remain |
| BETA-03 | Faithful full-density splash and native alarm appearance | owner-approved beta-fixes plan | implemented/unverified | [Individually approved splash v3 activated; captured native colors and signed build pass](evidence/2026-10-09-beta-fixes.md); actual splash/OEM/native-frame observations remain |
| BETA-04 | Trace and repair Recents afterimage | owner-approved beta-fixes plan | pending | [No connected target; scoped signed-device reproduction/trace cannot proceed](evidence/2026-10-09-beta-fixes.md); root cause remains unproven |
| BETA-05 | Themed Trash confirmation, compact independent Date/Time and single dismissing feedback | owner 9 October correction; TRASH-01 | implemented/unverified | [374 shared and 77 tooling tests; signed bundled assembly; themed confirmation, Undo and lost-reply fixture review](evidence/2026-10-09-permanent-trash.md); responsive timing controls reviewed; Android picker, timeout and TalkBack observations remain |
| ALERT-01 | Original-alert overdue and No alert recurrence anchors | owner-approved alert experience plan | implemented/unverified | [172 native tests and timing evidence](evidence/2026-10-09-alert-experience.md); query/count/pagination, DST, edits and recurrence pass; physical observations remain |
| ALERT-02 | Native Done, captured Done all/Snooze all and durable recovery | ALERT-01 | implemented/unverified | [Protected recovery and native action evidence](evidence/2026-10-09-alert-experience.md); captured membership, settings/stale guards, partial outcomes and exact retries pass; signed-phone Direct Boot/audio remain |
| ALERT-03 | Inline Alert choices and consistent app/native/notification actions | ALERT-02 | implemented/unverified | [367 shared tests and control evidence](evidence/2026-10-09-alert-experience.md); stacked inline choices and duration/feedback checks pass; broader render and Android observations remain |
| ALERT-04 | Shared Agenda/Completed/Skipped/Trash cards and compact status | ALERT-01 | implemented/unverified | [Eight-pair terminal row and menu evidence](evidence/2026-10-09-alert-experience.md); borderless 48dp More, selection and 200% rows inspected; stalled browser limits remaining rendering/TalkBack acceptance |
| ALERT-05 | Integrated alert experience verification and signed preparation | ALERT-01–04 | implemented/unverified | [367 shared, 77 tooling, 172 native tests and final signed preparation pass](evidence/2026-10-09-alert-experience.md); remaining browser-render checks and consolidated signed-phone observations pending |
| P0-01 | Expo 57 scaffold, pinned Node/JDK and tracked native project | none | verified | [clean CI, signed offline installation](evidence/2026-10-04-native-slice.md) |
| P0-02 | AI instructions, contracts, backlog, verification scripts/CI | P0-01 | verified | [shared/native commands and clean GitHub verification](evidence/2026-10-04-native-slice.md) |
| G0 | Foundation release gate | P0-01/02 | verified | [clean checkout and signed bundled UI offline on Pixel](evidence/2026-10-04-native-slice.md) |
| P1-01 | Native persistence, asynchronous bridge, recovery records | P0-01 | implemented/unverified | [Room recovery tests pass; remaining physical crash boundaries](evidence/2026-10-04-native-slice.md) |
| P1-02 | Independent alarm, receiver, FGS, audio, Stop/Snooze | P1-01 | implemented/unverified | [cold/locked delivery, cutoff and actions observed; remaining independent/recovery matrix](evidence/2026-10-04-native-slice.md) |
| P1-03 | Cutoff, Direct Boot, recovery and lifecycle verification | P1-02 | implemented/unverified | [reboot fix and owner confirmations; remaining consolidated matrix](evidence/2026-10-04-native-slice.md) |
| P1-04 | Preserve usable notification controls on Snooze re-trigger | P1-02 | verified | [owner confirmed initial/re-triggered buttons; second Snooze registered and final native Stop logged](evidence/2026-10-04-native-slice.md) |
| P1-05 | Structured native command validation | P1-01 | verified | [invalid fields/generations leave data and registration unchanged; shared/native checks pass](evidence/2026-10-04-native-slice.md) |
| P1-06 | Persisted interruption tests and installed-build evidence | P1-01, P0-02 | verified | [20 native tests; preflight distinguishes installed APK from local build](evidence/2026-10-04-native-slice.md) |
| G1 | Native alarm reliability gate | P1-01/02/03/04/05/06, G0 | verified | [Owner's 9 October acceptance on identified signed APK](evidence/2026-10-09-owner-g1-g3-attestation.md); owner attestation, no invented device/scenario coverage; BETA-04 remains open |
| P2-01 | One-off create/detail/views, readiness and timing controls | P1 implementation; physical acceptance deferred | implemented/unverified | [shared/native checks; signed UI acceptance deferred](evidence/2026-10-04-one-off.md) |
| P2-02 | Done/Postpone/post-timeout actions and session grouping | P1 implementation; physical acceptance deferred | implemented/unverified | [action/generation tests; collisions/audio acceptance deferred](evidence/2026-10-04-one-off.md) |
| P2-03 | Settings, diagnostics, export/restore, upgrade safety | P2-01/02 | implemented/unverified | [restore conflicts and both v1→v2 migrations pass; physical transfer/file checks deferred](evidence/2026-10-04-one-off.md) |
| G2 | Complete one-off private beta | P2-01/02/03 | verified | [Owner's 9 October acceptance on identified signed APK](evidence/2026-10-09-owner-g1-g3-attestation.md); owner attestation; unrelated verification rows unchanged |
| P3-01 | Pure Kotlin recurrence kernel and portable fixtures | P2 implementation; physical acceptance deferred | implemented/unverified | [fixtures/count/gap/fold/travel checks; physical acceptance pending](evidence/2026-10-04-offline.md) |
| P3-02 | Exceptions, series edits and protected replenishment | P3-01 | implemented/unverified | [protected replenishment, pause/split/restore and interruption tests](evidence/2026-10-04-offline.md) |
| P3-03 | Original accessible polish, management and history | P3-01/02 | implemented/unverified | [shared checks; device usability/accessibility deferred](evidence/2026-10-04-offline.md) |
| G3 | Complete Android reminder product | P3-01/02/03 | verified | [Owner's 9 October acceptance on identified signed APK](evidence/2026-10-09-owner-g1-g3-attestation.md); owner attestation; no unspecified OS/device matrix inferred |
| UX-01 | Tokens/icons, unified agenda queries, search/filter, Completed and Trash | P3-01/02 | implemented/unverified | [host query tests and narrow fixture review; physical usability pending](evidence/2026-10-04-redesign.md) |
| UX-02 | One-off/repeat editor, details, scope selection and Activity | UX-01 | implemented/unverified | [shared checks and fixture review; native picker/Back/keyboard acceptance pending](evidence/2026-10-04-redesign.md) |
| UX-03 | Categorized automatic preferences, inline permissions, Test alarm | UX-01 | implemented/unverified | [sequencing/retry/contrast tests; phone persistence and permission-return checks pending](evidence/2026-10-04-redesign.md) |
| UX-04 | Native controls/snapshot dismissal, notifications, launcher/splash identity | UX-01 | implemented/unverified | [session/Direct Boot/notification tests; signed physical actions and icon masks pending](evidence/2026-10-04-redesign.md) |
| UX-05 | Signed 0.4.0, consolidated checklist and release evidence | UX-01/02/03/04 | implemented/unverified | [shared/native verification and signing; owner U/A–E observations pending](evidence/2026-10-04-redesign.md) |
| UX-06 | Explicit Undo, stale draft review, search Back and uncertain restore recovery | UX-01/02/03 | implemented/unverified | [revision/civil/conflict/restore regressions; signed-phone interactions pending](evidence/2026-10-05-ui-refinement.md) |
| UX-07 | Shared presentation, Collections, rows, family Repeats and recent history | UX-06 | implemented/unverified | [host native queries and fixture interaction review; TalkBack/large-text acceptance pending](evidence/2026-10-05-ui-refinement.md) |
| UX-08 | Transactional repeats, zone-aware editor/details and contextual Settings feedback | UX-06/07 | implemented/unverified | [48 shared tests, 78 native tests, DST conversion and fixture review; native pickers pending](evidence/2026-10-05-ui-refinement.md) |
| UX-09 | Geometric R exports, aligned native tokens and consolidated refinement evidence | UX-07/08 | implemented/unverified | [deterministic icon exports and signed ARM64 assembly; owner acceptance pending](evidence/2026-10-05-ui-refinement.md) |
| TK-01 | Shared tool selection, stable build receipts and release serialization | P0-02 | verified | [host fixtures, doctor and signed ARM64/x86-64 assembly](evidence/2026-10-05-workflow-kit.md); no application/version changes |
| TK-02 | Safe ABI-aware deployment and reusable device preflight | TK-01 | verified | [host fixtures, blocked/successful dry-run and mismatch preflight](evidence/2026-10-05-workflow-kit.md); [owner deployment and installed hash confirmed after randomized-path fix](evidence/2026-10-05-phone-deployment.md) |
| TK-03 | Scoped logs/capture, isolated preview and combined release preparation | TK-01 | verified | [help, scoped process/environment fixtures, HTTP preview and full host preparation](evidence/2026-10-05-workflow-kit.md); real device captures pending |
| TK-04 | Discoverable repo skills and workflow documentation | TK-02/03 | verified | [bundled skill/metadata validation and workflow evidence](evidence/2026-10-05-workflow-kit.md); scripts are the shared procedure |
| TK-05 | Fetch the original design-audit baseline when historical branches disappear | P0-02; TD-CLEANUP; owner CI failure report | implemented/unverified | [223 source/88 tooling checks, exact-SHA GitHub fetch and Android verification](evidence/2026-10-11-design-history-ci.md); four clean-clone/failure regressions retain original deletion/protection checks; push and fresh GitHub verification remain |
| TK-06 | Update verification actions to Node 24 runtime versions | P0-02; owner CI deprecation warning | implemented/unverified | [Official v7 manifests, workflow syntax/input checks and design audit](evidence/2026-10-11-ci-actions-runtime.md); both jobs retain the Remilo Node 22.23.3 pin and explicit baseline fetch; push and fresh GitHub verification remain |
| DS-01 | Shared Gradle build/inspection without receipts or release locks | TK-01 | verified | [signed ARM64/x86-64 assembly and full host preparation](evidence/2026-10-05-deployment-simplification.md); no Git or receipt prerequisite |
| DS-02 | Sequential one-command deployment with target selection | DS-01 | verified | [35 controlled tooling cases, cancellation and optional launch](evidence/2026-10-05-deployment-simplification.md); simplified real-device deployment smoke remains pending |
| DS-03 | Optional diagnostics, concise skills and current workflow guidance | DS-01/02 | verified | [doctor, discovery/preflight, help, three skill validators and metadata](evidence/2026-10-05-deployment-simplification.md); no new phone mutation |
| UX-10 | No alert recovery repair and shared schedule/work/delivery presentation | UX-08 | implemented/unverified | [62 domain tests; retained history/overdue recovery; signed-phone comprehension pending](evidence/2026-10-05-second-refinement.md) |
| UX-11 | Browse roots, recorded Activity, recoverable completed cleanup and sound preview | UX-10 | implemented/unverified | [96 native tests; preview ownership and fixture interactions; Android Back/audio acceptance pending](evidence/2026-10-05-second-refinement.md) |
| UX-12 | Managed Lists, content schema 4 and backup format 3 | UX-11 | implemented/unverified | [upgrade/legacy/empty/stale/template/import regressions; signed ARM64 build; phone upgrade pending](evidence/2026-10-05-second-refinement.md) |
| TD-DOC | Four-atmosphere documentation/reference realignment | owner A36 documentation instruction | verified | [documentation/hash/link checks](evidence/2026-10-08-time-of-day-realignment.md); documentation/reference scope only, production TD units remain pending |
| TD-CLEANUP | Remove obsolete design material and review tooling; consolidate current guidance | owner A37 cleanup instruction | verified | [exact removals, protected references and shared/native/preview checks](evidence/2026-10-08-design-cleanup.md); production redesign and physical acceptance remain pending |
| TD-ART | Prepare production atmosphere artwork with sequential owner approval | approved production-asset preparation plan; all eight R3 references | implemented/unverified | Eight active scenes individually approved in the [registry](design/production-assets/manifest.json), including Night Light/Dark v2; [scene/crop validation](design/production-assets/records/scenery-validation-v2.json) and integrated hash/native-equality checks pass. All six circle-centered Classic v2 exports are individually approved and integrated in [TD-05](handoffs/redesign-td-05.md). Original bytes/v1 decisions remain preserved; masters are 1672 × 941 against the unmet 2048 × 1152 target. Artwork/export delivery and host checks do not establish physical runtime/branding acceptance. |
| TD-ART-SKILL | Reusable visual asset preparation skill and personal discovery | approved skill implementation plan | verified | [package, 52 passing tests, four independent workflow evaluations, asset/history preservation and cross-project discovery](evidence/2026-10-08-visual-asset-skill.md); [canonical skill](../.agents/skills/prepare-visual-assets/SKILL.md) uses [project configuration](../.agents/visual-assets.json), individual approval and recoverable promotion; current scenery resolution shortfall and production acceptance gates remain unchanged |
| TD-01 | Shared foundations | approved R3 and native/product baseline | implemented/unverified | [TD-01 handoff](handoffs/redesign-td-01.md); canonical roles/crops, shared components, verifier, contrast and all-eight fixture review recorded; [final integrated checks/signed assembly pass](handoffs/redesign-td-06.md). Physical accessibility/crop/IME acceptance remains pending. |
| TD-02 | Global Appearance | TD-01 | implemented/unverified | [TD-02 handoff](handoffs/redesign-td-02.md); Automatic/manual appearance, native-safe mirror and CE5/DP4 implemented; persistence/migration and [final integrated host checks pass](handoffs/redesign-td-06.md). Actual clock/zone/lifecycle/draft transitions remain pending. |
| TD-03 | App screens and remaining review | TD-01, TD-02 | implemented/unverified | [TD-03 handoff](handoffs/redesign-td-03.md); roots/origins, shared footers, editor/utility and native behavior corrections integrated; [latest 17:18 UTC host/signed preparation passes](handoffs/redesign-td-06.md), with 115 shared tests and unchanged 120-test native results. R9 compositions 01–04 remain rejected; [composition 05 approved for implementation](design/r9-runtime-composition-approval-v5.json), closing the checkpoint after actual menus/selection renders, two-item exact lost-reply Retry/Back guards and 200% long-text observations. Actual Android acceptance remains pending. |
| TD-04 | Native presentation | TD-01, TD-02 | implemented/unverified | [TD-04 handoff](handoffs/redesign-td-04.md); captured session presentation, privacy-safe projections and bundled scenes implemented; [120 native tests, owned lint and signed ARM64 assembly pass](handoffs/redesign-td-06.md). Physical native/alarm/privacy acceptance remains pending. |
| TD-05 | Static Classic branding | approved Classic source/A01 | implemented/unverified | [TD-05 handoff](handoffs/redesign-td-05.md); all six circle-centered Classic v2 exports approved/integrated; copier/hash and [signed assembly checks pass](handoffs/redesign-td-06.md). Actual OEM masks/splash/notification acceptance remains pending. |
| TD-06 | Consolidated acceptance | TD-03, TD-04, TD-05; TD-01/02 integrated | implemented/unverified | [TD-06 handoff](handoffs/redesign-td-06.md); latest sequential release preparation passed 9 October 2026 at 17:18:00.718 UTC after final composition 05 presentation/wording corrections: 115 shared and 75 tooling tests, unchanged 120-test native results/lint, signed bundled ARM64 0.4.0/code 4 with current APK hash recorded. Earlier 17:01 pass preserved as history. [Owner composition 05 approval](design/r9-runtime-composition-approval-v5.json) closes R9 review. No install/publish; consolidated phone/G1/G2/G3 acceptance remains pending. |
| FUT-ICON | Optional dynamic/themed launcher icons | separate future scope decision | pending | One static Classic identity ships first; no alias/worker feature or current acceptance dependency |
| P4-A | Optional Google connection and one-off publishing | G3 | verified | [Owner's 11 October publishing sign-off](evidence/2026-10-11-owner-calendar-publishing-attestation.md); [host/build evidence](evidence/2026-10-09-calendar-publishing.md) and [timed publication repair](evidence/2026-10-11-calendar-repair.md) retained; owner attestation without supplied accepted APK identity or individual scenario coverage; P4-B–P4-D/G4 remain pending |
| P4-B | Explicit import and protected linked updates | P4-A | implemented/unverified | [230 shared/89 tooling/254 native tests, lint, fixture observations and identified signed artifact](evidence/2026-10-12-calendar-linking.md); [owner-approved contract](calendar-linking.md); signed-device/live Google acceptance remains separate |
| P4-B01 | Import/linking contract and isolated fixtures | owner 12 October implementation instruction; P4-A | implemented/unverified | [Contract and strict memory-only fixture evidence](evidence/2026-10-12-calendar-linking.md); independent source calendar and explicit consent, including No alert |
| P4-B02 | Native event mapping, browsing and conditional patches | P4-B01 | implemented/unverified | [Mapping/transport evidence](evidence/2026-10-12-calendar-linking.md); owned scopes, bounded ordered pagination, sparse If-Match patches and safe 412 outcomes |
| P4-B03 | CE 7→8 identity, atomic import and local scheduling recovery | P4-B02 | implemented/unverified | [Migration/transaction/crash/privacy evidence](evidence/2026-10-12-calendar-linking.md); DP 6/backup 4 retained; one allocated occurrence/source and serialized checkpoints |
| P4-B04 | Reviewed linked resolution, consent and durable partial recovery | P4-B03 | implemented/unverified | [Conflict/retry/removal evidence](evidence/2026-10-12-calendar-linking.md); common baseline, independent timing and postponement preserved; obsolete operations fenced |
| P4-B05 | Browser, compact review, Details status and scoped recovery | P4-B04 | implemented/unverified | [Eight-pair and focused large-text/landscape fixture observations](evidence/2026-10-12-calendar-linking.md); full state matrix and Android Back/keyboard/TalkBack remain for consolidated acceptance |
| P4-B06 | Host/native/render checks, signed artifact and consolidated acceptance | P4-B05 | implemented/unverified | [Signed ARM64 0.4.0 (4), hash/signer/source relationship and host checks](evidence/2026-10-12-calendar-linking.md); [owner checklist](device-acceptance.md) extended; not installed or distributed; physical/live Google observations pending |
| P4-C | Recurrence mapping and differential tests | P4-B; owner 12 October approval | implemented/unverified | [Native recurrence/resource evidence](evidence/2026-10-13-calendar-sync.md); existing kernel, canonical master/instance/following identity, reviewed exceptions and scoped partial recovery; [supported subset](calendar-recurrence.md); signed-device/live Google acceptance remains |
| P4-D | Automatic two-way Calendar synchronization and clear management | P4-C; owner 12 October scope decision | implemented/unverified | [Implementation and actual evidence](evidence/2026-10-13-calendar-sync.md); reviewed permissions, ordinary transfers, persistent conflicts, independent local delivery, incremental work and clear management; visual matrix/accessibility and signed-device/live Google acceptance remain |
| P4-D01 | Automatic activation, compatible fields and baseline comparison | P4-C; P4-B | implemented/unverified | [Native comparison/activation evidence](evidence/2026-10-13-calendar-sync.md); five cases, cross-group merges, fresh individual/bulk previews, atomic immutable receipts, default opt-out and manual migration; no timestamp winner |
| P4-D02 | Incremental transport, pagination and expired-token recovery | P4-D01 | implemented/unverified | [Cursor/transport evidence](evidence/2026-10-13-calendar-sync.md); consistent queries, durable empty/page continuations, allowlisted snapshots, 410 cache rebuild and 412 fresh comparison |
| P4-D03 | Durable automatic jobs, timing and lifecycle recovery | P4-D01/02 | implemented/unverified | [Operation/timing/privacy evidence](evidence/2026-10-13-calendar-sync.md); per-resource checkpoints, provenance, unknown inspection, newer dirty edits, ringing deferral, independent/postponed timing and lifecycle fences |
| P4-D04 | Foreground and native background synchronization opportunities | P4-D03 | implemented/unverified | [Worker evidence](evidence/2026-10-13-calendar-sync.md); WorkManager 2.12.0, hourly network/flex request, native bounded continuations/backoff, application context and unlocked on-demand initialization; actual Android background timing remains |
| P4-D05 | Consistent status/actions and compact Calendar management | P4-D03/04 | implemented/unverified | [Projection/component evidence](evidence/2026-10-13-calendar-sync.md); shared states, saved-only opening, Sync now/read-only Check, separate neutral Unlink, external 48 dp action and CE Activity; full visual/accessibility acceptance remains |
| P4-D06 | Persistent review notices and quiet grouped notifications | P4-D03/05 | implemented/unverified | [Review/notification evidence](evidence/2026-10-13-calendar-sync.md); family queue/count, generic low-importance channel, durable fingerprints, dismissal/preference/restart behavior and stale safe navigation; signed-device observations remain |
| P4-D07 | Integrated automatic-sync regressions and signed acceptance | P4-D01–06 | in progress | [242 shared/91 tooling/329 native checks, lint and identified signed ARM64 artifact](evidence/2026-10-13-calendar-sync.md); [consolidated checklist](device-acceptance.md); browser navigation/focus deadlines limited fixture review; full eight-pair/accessibility review and signed-phone/live Google observations remain |
| P4-E | Managed Calendar setup and automatic reminder import | P4-C/D; owner 13 October implementation instruction | implemented/unverified | [Host/build evidence](evidence/2026-10-14-calendar-managed-sync.md), [representative production fixtures](evidence/2026-10-14-calendar-managed-visual.md) and [contract](calendar-managed-sync.md); P4-D07/P4-E08 signed-phone/live Google acceptance and G4 remain open |
| P4-E01 | Foundation, source identity and CE migration | P4-D | implemented/unverified | [Native evidence](evidence/2026-10-14-calendar-managed-sync.md); CE 11→12 stable installation identity, scoped guards/reservations, quiet fresh recovery, unchanged DP 6/backup 4 and no migrated permission |
| P4-E02 | Discovery, authorization and setup review | P4-E01 | implemented/unverified | [Native/UI evidence](evidence/2026-10-14-calendar-managed-sync.md); saved renamed ID, strict secondary/data owner, canonical name, complete bounded discovery, multiple selection, read-only sample and incremental creation consent |
| P4-E03 | Durable calendar creation and uncertain-result recovery | P4-E02 | implemented/unverified | [Recovery evidence](evidence/2026-10-14-calendar-managed-sync.md); immutable receipts, sent/result checkpoints, CalendarList verification, exact-marker inspection and no blind uncertain POST retry |
| P4-E04 | Incremental candidates and automatic imports | P4-E03 | implemented/unverified | [Import evidence](evidence/2026-10-14-calendar-managed-sync.md); shared cursor, frozen initial cohort, ongoing/future timing, lazy families, bounded resumable audits and captured exception checks |
| P4-E05 | New-reminder export and reviewed adoption | P4-E04 | implemented/unverified | [Publication/backup evidence](evidence/2026-10-14-calendar-managed-sync.md); atomic genuine-create intent, family Local only, stable resource recovery, reviewed adoption and exact restore collision protection |
| P4-E06 | Policy, Pause, reviewed Resume and lifecycle recovery | P4-E05 | implemented/unverified | [Native recovery evidence](evidence/2026-10-14-calendar-managed-sync.md); future-only defaults, selected immutable resume batches, held intent, separate manual authority, recovered-alert review and source/terminal/Purge fences |
| P4-E07 | Settings, editor, management and generalized review | P4-E06 | implemented/unverified | [Projection evidence](evidence/2026-10-14-calendar-managed-sync.md), [fixture observations](evidence/2026-10-14-calendar-managed-visual.md); reminder-first controls, saved phases/counts, candidate/setup routing, quiet issues and Activity |
| P4-E08 | Integrated regressions, visual evidence and signed acceptance | P4-E01–07 | in progress | [257 shared/91 tooling/423 native checks, lint and identified signed ARM64 artifact](evidence/2026-10-14-calendar-managed-sync.md); representative eight-pair/large-text fixtures; [consolidated signed-phone/live Google and Android accessibility observations](device-acceptance.md) remain |
| G4 | Calendar release gate | P4-A/B/C/D/E | pending | Managed discovery/reuse/creation and recovery, both directions after documented opportunities, protected conflicts/unknown writes, recurrence, independent deletion and quiet review notices on an identified signed build |
| RW-01 | Reusable weekly workout plans with named exercises/steps and day-specific schedules | G3 | pending | different days have different checklists; plan survives daily completion |
| RW-02 | Today workout checklist and date-aware app surface | RW-01, UX-10/11 | pending | per-exercise Done/Undo tracked by local date; yesterday/tomorrow do not leak into today |
| RW-03 | Readable Android home-screen Today widget | RW-02 | pending | today's plan/reminders update across midnight, edits, reboot and completion without opening React Native |
| RW-04 | Optional daily Today/agenda digest notification | RW-02 | pending | configurable local time, opt-in and quiet dismissal; no duplicate or alarm-channel behavior |
| AI-01 | Android assistant/intent compatibility research and action contract | G3 | pending | current official support matrix for Android intents, Gemini/AppFunctions, Samsung/Bixby, versions and limits |
| AI-02 | Safe external create-reminder/alarm actions and supported Android entry points | AI-01 | pending | voice/deep-link/shortcut intent drafts previewed, explicitly confirmed and saved once through native engine |
| AI-03 | Optional assistant-specific discovery/registration where actually supported | AI-01/02 | pending | test real Pixel and Samsung providers; unsupported assistants degrade gracefully; no universal-routing claim |
| AI-04 | Optional local natural-language drafting enhancement | AI-02 | pending | deterministic/offline parser remains usable; AI is opt-in, capability-gated and never bypasses confirmation |
| G-AND-EXT | Android daily-workflow and external-action acceptance gate | RW-01/02/03/04, AI-02 | pending | signed-phone date/permission/restart/widget/digest/intent checks; AI-03/04 optional and non-blocking |
| P5 | Optional Android cloud/primary-device coordination | G4 | pending | foreground/manual Supabase sync and honest handoff |
| G5 | Android cloud gate | P5 | pending | two Android installations converge |
| P6 | Optional iOS feasibility and complete port | G5, G-AND-EXT | pending | final phase only, after Android expansion; real iPhone capability evidence |

## Task verification contracts

- TD-01–TD-06 are the active theme roadmap under A36. Image/template acceptance
  is not implementation completion. TD-DOC records this documentation/reference
  PR only. Keep R9 composition review, the fixed icon-free list decision and actual token/render/device
  evidence explicit. Existing native reliability and unrelated feature gates remain.
- A37 removes superseded design tasks and prototype evidence from the checkout.
  Current TD requirements and unrelated native/product gates remain unchanged.

- P0-01: shared checks and bundled Android assembly; clean-checkout CI and signed
  offline installation are separate evidence requirements.
- P0-02: verify commands work from documented toolchains; CI results identify their
  commit. Instructions never claim a manual observation from an automated result.
- P1-01: Room tests exercise create retries, interrupted projections, history replay,
  stale delivery actions, permission-blocked saves and cold recovery. Physical crash
  boundaries remain part of G1.
- P1-02: native policy tests, lint and release assembly; physical cold process,
  permission flow, Stop/Snooze and independent registrations require device evidence.
- P1-03: all G1 procedures in verification.md, with durations and human observations.
  Missing observations remain pending under the owner's deferred acceptance run;
  known failures must be fixed before claiming reliability.
- P1-04: publish complete native controls before service promotion; test the actual
  first and re-triggered notification, old-action rejection and generic pre-unlock
  text. Verify Stop/Snooze on the signed phone build after a ten-minute Snooze.
- P1-05: native command errors identify the field without exposing private values;
  invalid commands leave content, operational generations and OS registration
  unchanged. Native authority validates independently of JavaScript form checks.
- P1-06: seed committed storage boundaries, restart the engine and verify recovery
  without duplicate definitions/history or revived stopped generations. These are
  host tests, not injected physical crashes. Device preflight records available
  local and installed APK hashes separately without source attribution. Missing
  or mismatched artifacts are diagnostics; transport/inspection errors fail.
  Preflight never changes the installed app or declares physical observations.
- RW-01/02: reuse the existing recurrence and occurrence identity where possible;
  audit the native schema before adding workout step templates, per-date completion
  and history. Each exercise check has stable identity, cannot delete its weekly
  template, and is independent of Stop/Snooze/alert delivery. Today respects the
  device's local date/time zone and calendar-day rollover, even across process
  death and travel. Design a focused Today presentation, not a general task manager
  or mandatory bottom-navigation redesign.
- RW-03: use a supported Android widget mechanism and native read/action path;
  React Native/Metro/network must not be required for refresh or completion.
  Show no private content before unlock without permission, and test stale widgets,
  size variants, midnight/time-zone transitions and device restart.
- RW-04: digest is explicitly opt-in with editable delivery time and off switch.
  Show only authorized local data (plus opted-in linked Calendar events when
  P4 permits); no silent alarm-mode downgrade, duplicate notifications, or
  promises of exact delivery under OS restrictions. Never use this informational
  notification to ring or modify reminder completion.
- AI-01: validate official APIs and actual provider behavior first. Android
  interfaces offer possible entry points, not a universal Gemini/Bixby contract;
  document supported OS/app/version prerequisites and graceful fallbacks.
- AI-02: external utterances/intents may propose titles, times, recurrence and
  alert mode but must resolve ambiguity and obtain explicit user confirmation.
  Strict native validation, idempotent command identity, permissions and existing
  Done completion and unfinished Snooze/Postpone semantics remain authoritative,
  including legacy Stop command compatibility. Do not intercept a generic
  Android clock alarm without a tested, user-visible handler/selection contract.
- AI-03/04: vendor-specific registration and optional on-device ML are deferred
  capability improvements. Neither is required for baseline external creation;
  no cloud inference, always-on assistant, AI chat, credential upload or AI service
  dependency is introduced by default. Keep the non-AI manual flow intact.
- G-AND-EXT: run relevant host/native tests and then signed-device checks for
  day rollover, per-step history, native widget privacy/actions, digest settings,
  external intents and repeated/stale request behavior. Inaccessible third-party
  assistant APIs are recorded as unsupported, not falsely verified.
- Later task groups are split into bounded work units when activated. Each new row
  must include purpose/scope, dependencies, behavior, required checks and evidence;
  place its status only in this backlog.
- UX-01: verify grouping before pagination, deterministic ties, full counts and
  overdue/postponement independence. Inspect 360×800 populated layout and complete U1–U4.
- UX-02: preserve timing/rules and Save-only mutations; no lost drafts or raw engine
  wording. Verify native date/time selection, Back/sheets, validation and all scopes (U5/U6).
- UX-03: test coalescing, refreshed revisions, rollback, lost acknowledgement/read,
  stale revisions and subscription teardown. Phone checks U7/U8 remain distinct.
- UX-04: test initial/loading and refresh/session races, final versus partial actions,
  old Stop all and generic pre-unlock snapshots. U9/U10/U12 recheck real presentation.
- UX-05: pass shared/native/lint/signed assembly, record source/hash/signer, and keep
  unobserved physical/200%-font/TalkBack scenarios pending in the single owner checklist.
- TK-01–04 record the original toolkit contracts and evidence. Their receipt,
  serialization and deployment-preflight details are superseded by DS-01–03.
- TK-01: select/report pinned tools, detect configuration conflicts, attribute only
  stable build inputs and serialize assembly/inspection/install. Require actual APK
  inspection, hash and signer; controlled cancellation must not imply success.
- TK-02: verify explicit/env/single-target precedence, unauthorized/offline/ambiguous
  failures, API/ABI eligibility, safe in-place arguments and default no-launch.
  Accept Android randomized APK directories while rejecting unsupported/split paths.
  Failed post-install verification stays separate from successful installation.
  Use read-only local dry-run; do not initiate phone installation/alarm testing.
- TK-03: scoped tag logs without clearing, binary capture, child-only preview vars,
  and signed release preparation without installation/publication. Verify help and
  controlled process fixtures, then shared/native checks. Real capture/live-log and
  emulator deployment results are distinct from host fixtures.
- TK-04: validate three scoped skills with the bundled validator, keep procedures
  in scripts, and document actual host evidence. No global skill installation.
- DS-01: remove receipt, fingerprint and lock prerequisites from active build
  callers. Reuse the committed Gradle wrapper and existing signing identity; inspect
  actual APK output and retain compatible ARM64/x86-64 assembly. Run shared/native
  verification without changing the application version or behavior.
- DS-02: expose only `--device SERIAL`, `--launch` and `--help`; automatic target
  selection requires one listed authorized transport. Fail prerequisites, API/ABI
  and artifact validation before installation. Use the selected serial with
  `install -r --user 0`; leave UI closed by default. Tests cover cancellation,
  install failure, separate launch failure, paths with spaces and preview isolation.
  Missing receipts and unavailable Git metadata must not block deployment.
- DS-03: keep doctor/devices/logs/capture/preview/preflight/release preparation
  optional. Preflight diagnoses available APK hashes without source attribution.
  Validate three concise skills and document one release-producing workflow per
  checkout. Preserve historical evidence for TK-01–04 rather than rewriting it.
- UX-10: repair persisted None/Missed to NoAlert without reviving targets or losing
  overdue membership. Verify ordinary/independent/coincident timing, linked offsets,
  all-day/year/zone boundaries, changed/terminal/pending/blocked delivery and state
  eligibility. Presentation tests do not establish Android accessibility acceptance.
- UX-11: verify separate root state, origin and modal/search Back ordering, recorded
  Activity, completed/skipped Trash restoration and stale Undo. Alert problems
  applies before pagination/counts. Native identified preview tests cover replacement,
  failure/fallback, release/stop, late callbacks and real-alarm priority. U17–U20
  remain physical observations, alongside TalkBack/200% text and native pickers.
- UX-12: verify CE upgrades 1/2/3→4, exact legacy case variants, empty lists,
  removed references, every retained template, unchanged operational generations
  and targets, backup v1/v2/v3 readers, matching-ID preservation, distinct-name
  restored suffixes, family copy decisions and retry stability. Run shared/native
  verification and record the signed artifact without installing or distributing.

## Simplified deployment owner smoke (pending)

Once host verification is recorded for DS-01–03, connect and authorize one test
device, then run `npm run deploy` from the repository root. Confirm installation
succeeds and Remilo stays closed. Open it yourself and confirm version 0.4.0 and
existing reminders are preserved. For multiple transports, select with `--device`.
This checks the development workflow; remaining alarm/product observations still
use [the consolidated owner checklist](device-acceptance.md). No new alarm-testing
sequence is required by the tooling simplification.

## Later workflow opportunities (outside this kit)

- Synchronized application-version bumping across Expo, npm and Gradle.
- Reproducible icon generation with a pinned Sharp dependency.
- Explicit toolchain download/bootstrap automation, with licensing and integrity checks.

## Host and device prerequisites

- Host Node 22.11 is unsupported; project-local verified Node 22.23.3 is installed
  under ignored .tooling (host installation remains intact).
- Verified portable Temurin JDK 17 and Android SDK/NDK/CMake are installed;
  SDK license acceptance was authorized by the owner. Global installations remain intact.
- A private beta signing identity exists locally; keys/properties are ignored.
- Pixel 9 Pro XL is USB-authorized. The owner's latest instruction defers further
  interactive phone checks to [one consolidated acceptance run](device-acceptance.md).
  Physical verification remains a release dependency, rather than a development gate.
- The owner created origin at https://github.com/Leo10250/Remilo.git and authorized
  pushing completed work. No APK distribution/public release is authorized.
