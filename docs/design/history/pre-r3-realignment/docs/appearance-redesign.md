# Remilo appearance and workflow design

**Current direction, 7 October 2026:** read
[the approved R3/R4 template and corrections](design/approved-ui-r3-r4.md) first.
A20 adds the approved R5 Sky/Evening Details/Editor variants and their generation
discrepancy corrections; use the combined twelve-screen gallery in that contract.
A22 accepts seven [R6 alarm/Postpone templates](design/remilo-r6-alarm-postpone/gallery.html)
and rejects the plain pre-unlock alarm. All native full-screen states support the
four global atmospheres with generic text before first unlock. A23 requires the
existing softer Dark surface roles. A24 accepts the four corrected Dark replacements
as starting templates with corresponding-theme background/color matching and
later detailed coloring/visual polish flexibility. Safe native appearance
storage/capture still needs technical refinement.

A27 accepts the [R7 Lists/Repeats/recurrence outline](design/r7-lists-repeats-specification.md)
as a sufficient UI/UX starting template with [annotated references](design/remilo-r7-lists-repeats/gallery.html).
Decorative list-icon presence/style is a generated discrepancy, not an approved
custom-icon feature. The owner favors omission and wants the decision raised
during implementation. Unrendered Night/state permutations inherit prior themes;
shared color/geometry/keyboard/native UX rules resolve raster drift.

A28 continues with [R8 Settings/Appearance/permissions/Test alarm](design/r8-settings-appearance-specification.md).
Its proposed layouts retain auto-saving preferences, independent brightness and
one global atmosphere, inline Android permissions, native sound preview and honest
Test results. All eight R3 images govern style. A30 accepts the direction/templates
shown before its response, with [thirteen associated references](design/remilo-r8-settings-appearance/gallery.html)
and a later R8-08 supplement. Apply their discrepancy corrections; no storage
change, four-scene automatic policy, safe Test API or actual render/device pass
is implied by that visual acceptance.

A31 starts [R9 Completed/Trash/Activity refinement](design/r9-completed-trash-activity-specification.md)
with [fourteen prospective captures](design/r9-completed-trash-activity-fixtures.json).
All eight R3 references govern color/style; native history, query filtering/order
and guarded recovery govern UX. Terminal text stays readable, collection rows
omit unproven action dates, and Activity contains only actual occurrence events.
Secondary-origin routing, skipped Reopen and uncertain collection retry are
explicit implementation gaps. The draft is proposed; no R9 images or new
acceptance/implementation result is recorded by this continuation.

A32, recorded 8 October, refines [Data/Help Export, Restore and Diagnostics](design/r10-data-help-specification.md)
with [fourteen proposed review states](design/r10-data-help-fixtures.json).
Use all eight R3 pairs and established native backup/retry/share/snapshot UX.
Export stays inline in Settings; Restore and Diagnostics return there. Preview
timing is informational, counts distinguish reminder/series units from lists,
and share handoff never proves destination delivery. Real import rejection,
request lifetime and diagnostic scope corrections remain implementation work.
[A33](design/r10-data-help-image-intake.json) later authorized fourteen examples,
saved in an external projectless review bundle. [A34](design/r10-restore-whole-backup-intake.json)
now confirms restoring the whole selected backup, with all new entries/lists added
automatically and existing local reminders unchanged. The r2 preview identifies
entries from that file and labels identity conflicts with explicit **Keep existing**
/ **Add a separate copy** choices instead of switches. [A35](design/approved-ui-r10-outline-acceptance.json)
subsequently accepts the r2 direction and current fourteen-state gallery as UI
templates, including that whole-backup behavior. Per-image discrepancy corrections
remain authoritative; raster colors/final art and measured accessibility are not
settled by the synthetic images. [R2 evidence](evidence/2026-10-08-r10-whole-backup-clarification.md)
preserves the earlier clarification scope. No production, runtime/device or task-status
change is implied.

The owner accepts the R3 homepage and overall R4 details/editor template with the
documented corrections. One global atmosphere and independent Light/Dark/System
brightness apply across app pages and the native alarm experience; Android still
owns notification layout and allowable styling. Task-specific Meadow environments,
manual reminder/series appearance and the associated chooser are deferred.
Earlier conflicting visual scope below is retained planning/history requiring
refinement, not authority to implement those deferred features. The four preview
atmospheres do not define replacement automatic times, migrations or defaults.
The layout direction is accepted; final artwork should become more abstract in
later artwork review, and image pixels do not define final component tokens.

The owner's specification takes precedence over earlier UI choices. This is the
single redesign product vision/requirements source, not an implementation report.
The [twelve-plan index](plans/redesign/README.md) owns execution boundaries;
task state is recorded only in [backlog.md](backlog.md). Physical acceptance stays
consolidated in [device-acceptance.md](device-acceptance.md). The earlier owner
instruction A16 authorized the refined P02 execution after A15 accepted the two
non-shipping P01 rendered compositions, following
A14's S1/M1 acceptance, A12's bounded r2 direction, A11 refinement and A10 execution.
The [P01 handoff](handoffs/redesign-p01.md) binds the accepted contract and evidence.
Exact production tokens, detailed UX and final production layouts remain open.
Other milestones require their own authorization.
A16 confirms 16 dp reminder tiles, Sky/Rose as the sample, artwork-only approval
before integration and shared Classic activation after complete-catalog approval.
Existing production layouts remain during P02; no artwork/sample/catalog is
accepted by execution authorization. See [P02](plans/redesign/p02-visual-foundations.md).
See [approval records](design/approvals.md).

## Direction and review gate

Use a hybrid experience: one calm illustrated atmosphere, restrained accents
in browsing, and richer contextual artwork on individual details/native alarms.
The supplied large Classic icon is the actual intended identity. Preserve its
blue-to-violet ring, white check medallion, orange sun and glossy finish; do not
replace it with the earlier geometric R or a generative reinterpretation.

Environmental artwork must be broad, layered and integrated into screen regions,
in a consistent soft cartoon/editorial style. Restrained daily artwork means calm
hierarchy and readable negative space, not an almost invisible footer. The isolated
glossy sprig is not the approved illustration strategy. The supplied references
are [preserved here](design/references/README.md). A15 accepts the two P01
representative compositions; broader production compositions/values remain open.

The first gate is now [P01](plans/redesign/p01-art-direction.md): audit
reference/current output, define an explicit style contract, and compare original,
current and corrected representative Agenda and Water plants alarm renders.
Agenda follows the time-of-day atmosphere. A single Water plants alarm uses a
cohesive Meadow environment; its initial canvas freezes for the session even if
other members join or leave. S1/M1 source artwork is accepted for P01 review integration;
the [actual rendered revision](design/p01-render-review-r1.html) is separately
accepted by [A15](design/p01-render-r1-acceptance.json). A12/A14/A15 satisfy the
P01 design checkpoints. More themes and production foundations require their own
milestone authorization and approvals.

The [owner's critical correction](design/references/p01-owner-correction-2026-10-06.md)
clarifies that the reference direction covers the whole UI: cards, type/spacing, headers,
forms, navigation, action/state presentation, alarms and appearance settings. P01 maintains
complementary [UI composition](design/ui-composition.md) and
[illustration](design/art-direction.md) specifications with explicit adaptations;
neither is approved by this link. After specification approval, the owner reviews a small
Meadow/Sunrise artwork-only set before actual integration. P01 implementation remains two
non-shipping representatives. P05/P06/P08 and other plans retain production ownership.

Existing A/B/C facilities remain useful comparison groundwork: immersive individual
surfaces, layered atmosphere, and hybrid. Comparisons use equal content, typography,
controls and semantics. They are not an obligation to expand every screen before
the representative gate. Visual appeal and passing tests do not establish approval,
usability, accessibility or physical reliability.

The isolated workspace is `/design-review` under `npm run preview:ui`. It uses
actual React Native shared controls, rows, recurrence, schedule and draft helpers
with memory-only fixtures. Normal builds resolve a redirect instead of this
workspace. Android always resolves the real native bridge. Native comparisons
render the actual extracted Compose controls using a non-exported debug-only
fixture activity and host native graphics. Browser alarm/notification examples
are labeled representations; they are not Android notification or phone evidence.

## Workflows

- Three labeled primary destinations: Agenda, Lists, Repeats. Overflow contains
  Completed, Trash and Settings. Named lists and overflow pages return to their
  origin. Root switching never accumulates history; Back from Lists/Repeats returns
  to Agenda after sheet/search/draft/uncertain-operation guards. Retain independent
  destination filters and scroll. Hide bottom navigation in editors/details.
- Agenda uses event-based sections, one Add control, near-white 16dp tiles,
  leading completion, a category glyph, clear title/event time and concise delivery
  cue. Keep consequential Due/Overdue, delivery failures/missed outcomes, changed
  targets and recurrence visible. Color never replaces a state label. Keep visible
  actions and revision-safe Undo, with optional equivalent swipe actions.
- Lists retain durable names, No list, compact overdue counts and explicit
  management. Their menu contains list-specific Completed/Trash. Repeats retains
  Active/Paused/Ended, rule summaries, next dates and earlier unfinished occurrences.
  Opening an occurrence is distinct from managing its family. Collections retain
  search/membership, recorded timestamps and recoverable actions.
- The common editor order is Title, event date/time, Repeat, explicit
  Alarm/Notification/No alert, List, optional Notes. Unused Notes is collapsed;
  existing notes remain visible. Repeat is editable for creation/family scopes;
  an individual occurrence retains family context without an editable Repeat row.
  Independent Due/end/all-day/zone controls live under Schedule options, with a
  consequential independent Due summary in the common form. An independent alert
  time stays visible in the common Alert area. Sound/vibration stay under Alarm
  options. One persistent Save footer stays above the keyboard, and focused Title,
  Notes, caret and field errors scroll clear of both footer and keyboard. No
  per-reminder appearance chooser is included in the current template.
  Preserve cancellation, stale-draft
  review, validation and same-operation retry.
- Details lead with title, event range and consequential Due, then one delivery
  outcome/next-alert area. Persistent Done/Reopen/Restore stays separate from
  ringing Stop/Snooze. Keep eligible Postpone after delivery ends. Activity,
  duplication and destructive actions live in More. Errors preserve known content
  with Retry; filtered emptiness offers Clear filters; uncertain saves remain guarded.

## Appearance contract

Keep existing `theme` as independent brightness: System, Light, Dark. Color is
Fixed or Time of day. Ship Classic, Sunrise, Sky, Meadow, Peach, Rose, Lavender
and Mist, each with intentional light/dark roles. The review catalog contains
unapproved sRGB candidates. Develop/review production tokens using Material HCT tooling,
then export reviewed static roles rather than introduce runtime generation.

Use system typography (16sp body, 14sp supporting), a 4dp spacing rhythm,
restrained elevation, 16dp reminder tile corners and larger sheet corners. Reuse the
encapsulated Material icons. Bundle static scenery outside essential text; it
yields to content and large text. No arbitrary photos or list-specific themes.

Appearance is a dedicated page near the top of Settings: brightness, color mode,
named checked swatches/live preview, time periods, Smart Reminder Colors and
independent launcher controls. Choosing a fixed swatch explicitly changes mode.
Reuse automatic preference saving with rollback and Retry.

| Local Period | Palette |
|---|---|
| 06:00-10:00 | Sunrise |
| 10:00-16:00 | Sky |
| 16:00-20:00 | Peach |
| 20:00-23:00 | Lavender |
| 23:00-06:00 | Mist |

Foreground appearance reconciles at boundaries, resume, clock and zone changes
without resetting drafts/scroll. Defer a boundary transition during a sheet/edit
until dismissal; reduced motion disables transitions. Brightness stays independent.

Reminder identity precedence is explicit occurrence/series policy, confident
Smart category, authored event-time band when time mode is on, then fixed/global
appearance. All-day items use content/global rather than midnight. Snooze/Postpone
never recolor identity; an event edit may. Pinned items use their named zone;
floating occurrences use the resolved occurrence zone.

Smart rules cover reviewed English phrases, unambiguous emoji and Simplified
Chinese phrases. Normalize case, punctuation, full-width forms and emoji sequences;
use English boundaries and Chinese phrase rules, never isolated-character inference.
Conflicting strong signals and unsupported content become General. Exclude notes
and list names. Categories are Health, Nature, Fitness, Food, Celebration/Social,
Focus, Rest, Home/Errands, General; glyphs distinguish shared palettes. Explanations
belong only in the appearance chooser. Durable manual choices survive edits;
explicit Auto can override an inherited manual policy. Review fixtures have authored
expected categories, not a shipping classifier or claims of learned intelligence.

## Native and storage boundaries

Kotlin owns saved appearance resolution/classification and versioned descriptors.
React Native renders them and requests bounded draft previews. One reviewed
catalog exports TypeScript/native tokens and assets. Classify during unlocked
content processing or bounded backfill, never delivery/audio startup. Appearance
failure always falls back to usable controls.

Native alarm sessions capture the initially presented reminder's environment as
a stable ambient canvas (Meadow for a single Water plants alarm).
Arrivals/member Stop never recolor it; richer member artwork and independent
Stop/Snooze remain. Stop all is session-specific. Label large time as current
ringing delivery and show consequential event timing separately. Before first
unlock use generic Classic/system controls. Standard notifications receive a
supported accent, monochrome brand silhouette and generic public presentation.
Android owns layout/actions; retain existing channels, permissions, immediate
foreground promotion and initial Stop/Snooze controls.

An identified revision-checked cosmetic native operation supports occurrence,
following and family scope. It changes credential metadata/presentation only:
no scheduling segment/generation or current Snooze/Postpone replacement. More
specific policies take precedence; following boundaries use stable nominal slots.
Retain policies through templates, materialization, archived segments, exceptions
and copied-family identity remapping.

P04 is planned as four units, each requiring separate execution authorization:
global configuration, internal manual policies, backup portability, then chooser
integration. Design policy and portability semantics together; manual mutations
remain internal/test-only until
the backup-v4 portability gate passes. Partial delivery is not whole-scope approval.

Version credential upgrades and portable backup format 4, retaining formats 1-3
readers. Operational schema 3/privacy is unchanged. Content-derived decisions
stay credential-protected. Export manual policies, not classifier cache, session
or launcher state. Restore preserves local global settings and recomputes unlocked
suggestions. Explicitly mark legacy installations, including missing settings rows:
preserve brightness, Classic/fixed and disabled automation. At the dynamic milestone
fresh installs receive time mode and Smart Colors. Unknown IDs render safe fallbacks
without destroying choices; classifier updates do not silently recolor cached decisions.

## Launcher personalization

Ship Classic in the foundation iteration. Runtime variants follow later. Classic
is default; users may choose a stable variant or Match app theme on opening/resuming
(the atmosphere, never an individual item). Explain the on-open behavior and Android/
launcher cache delays. Android system-themed icons follow system colors independently.
The owner now makes closed-app matching an optional, separately authorized P11B
extension, excluded from the first P12 gate; retain it as future scope, not a core promise.

Before aliases, move alarm-clock show handles and deploy launch targeting to stable
MainActivity. Do not disable MainActivity or alarm components. Atomically switch
exactly one launcher alias using PackageManager's supported batch API; defer during
Starting/Active native sessions and recover failure without hiding the app.

The earlier specification selected WorkManager for background matching. It is now
a candidate mechanism for optional P11B, not a required/pinned core dependency;
selection/version/compatibility need that extension's explicit approval. If selected,
initialize after unlock without React, remove only its initializer metadata, use a
unique delayed boundary continuation with current preferences/time and skip missed
boundaries. Reconcile unlocked boot/upgrade/time/zone events, cancel superseded work
and append a successor safely instead of replacing a running worker. Background
execution remains best effort. Core adds no worker/Startup changes or closed-app
triggers. No exact alarm, foreground service or polling for cosmetic changes.

## Execution authority

The provisional iteration 0-6 / AR-00-06 sequence is superseded by the
[P01-P12 index](plans/redesign/README.md) and twelve individual documents. Retain
existing review groundwork and its evidence; it is not an approved art direction.
Each future chat reads the individual plan, repository state, dependency handoffs
and approval ledger. P02-P12 require refinement against approved predecessor
outputs. No plan automatically authorizes another, installation or distribution.

Use [the handoff protocol](handoffs/README.md). Native persistence, scheduling,
recurrence, privacy and backup guarantees remain fixed throughout. The final
owner-operated phone run remains consolidated in P12; unobserved checks stay
pending and distribution requires separate authorization.

## Acceptance

Compare baseline/redesign at 360x800, larger/expanded views, long English/Chinese,
all-day/independent timing, repeats, overdue/stopped/postponed/manual choices,
empty/loading/refresh errors and simultaneous alarms. Require clearer scanning,
no extra mandatory creation step, discoverable destinations and correct
event/Due/alert and Stop/Done comprehension.

Verify rendered text >=4.5:1 (large >=3:1) and essential controls/selection/focus
>=3:1, including artwork composites, all light/dark palettes, 200% text, TalkBack,
keyboard, reduced motion and grayscale. Maintain >=48dp app targets and non-color
state cues. Token math alone does not establish rendered accessibility.

Automate classifier ambiguity/languages/emoji/precedence, credential upgrades and
old readers, policy portability, generation/target preservation, unavailable
credential storage, frozen sessions, preference retry races and late/cancelled
workers only if optional P11B is authorized/implemented. Run `npm run verify` and
relevant `npm run verify:android`; never substitute
browser or emulator results for physical evidence.

Daily Mix, more palettes, list themes and offline ML are deferred. Weather,
location, cloud inference and iOS are excluded. Chinese classification/text rendering
does not mean whole-app translation. Application ID, signing identity, scheduling
semantics and offline native alarm ownership remain fixed.
