# P01 reference-pattern evaluation and research — r2

Part of the proposed `P01-style-r2` bundle, 6 October 2026. This evaluates the owner's
[correction](references/p01-owner-correction-2026-10-06.md) against actual repository code
and primary guidance. **Classifications are recommendations awaiting approval**, not new
product requirements. Adopt = preserve the quality; Adapt = preserve it with explicit
semantic/accessibility changes; Reject = do not reproduce the specific conflict;
Investigate = resolve through a bounded trial. None authorizes production implementation.

## Reference observations

Both attachments were inspected at original resolution, along with all five saved visual
inputs and actual 100%/200% RN/Compose baseline captures. Attachment A is byte-identical to
the saved time board. Attachment B is a distinct 1536×1024 file with the same illustrated
Butter/Periwinkle/Sage composition; it is [preserved separately](references/butter-periwinkle-sage-owner-2026-10-06.png).
Do not overwrite the earlier B source. See the [inventory](references/README.md) for hashes.

A: strong left brand/right actions; quiet chips; separated rounded tiles; small group
counts; title/secondary-time hierarchy; landscape behind a compact Add; full botanical
upper alarm region and a closely connected title/time/status/action sequence. Its Night
scenery consumes excessive list space, small/faint labels need adaptation, and its settings
contain unapproved behavior options. B: title field plus aligned compact form rows, clear
header Save, separate date/time affordances, discreet Notes, and consistent interactive
color. Its isolated object alarm illustrations are weaker botanical guidance than A/the
desired plant crop. Its notification cards are concepts, not platform renders.

The current RN/Compose captures preserve actual controls and useful semantics, but their
harder cards, separate vertical bands, sparse alarm geometry and unrelated art do not meet
the owner's preferred whole-screen quality. Passing engineering checks cannot resolve that.

## Pattern decisions

| Pattern | Classification | Recommendation / reason | Validation and implementation owner |
|---|---|---|---|
| Agenda header | Adopt + Adapt | Prominent left Remilo, compact alignment, Search/Overflow right. Grow for text and keep filter discoverable; contextual list title/Back preserves origin. | P01 representative; P05 search/filter/Back workflows. |
| Reminder cards | Adopt + Adapt | Separate rounded near-white tiles; modest corner softness, tonal separation, 16/14 sp hierarchy, leading circle. Remove heavy outline/stripe, retain meaningful metadata and accessible More. | P01 standard/overdue/changed delivery/long-title comparisons; P02 primitives, P05 production. |
| Date grouping / counts | Adapt | Preserve Today/Tomorrow and required Earlier/Overdue groups. Native filtered group totals before pagination; collapsed totals remain correct. | Existing query contract; P05 scoped/search/paged/empty cases. |
| Filter chips | Adapt; Reject literal labels | Apply selected/removable chip language to real filters. Do not introduce undefined Later or replace root destinations. Resting Agenda need not carry four redundant chips. | P01 context treatment; P05 discoverability and 200% height budget. |
| Bottom navigation | Adopt approved architecture; Adapt style | Keep labeled Agenda/Lists/Repeats with calm selected surface/indicator. No duplicate top roots; hide on editor/detail. Preserve keyed state and Back. | P05; existing P01 review nav remains fixture-only. |
| Completion feedback | Investigate | Responsive circle feedback, confirmed check/removal, accessible Undo; optimistic durable-state claims need failure/uncertain reconciliation. Reduced-motion equivalent. | P01 memory-only demonstration if approved; P05 behavioral approval and tests. |
| Environmental scenery | Adopt + Adapt | Full atmosphere, exposed landscape/edge foliage; no blank decorative panel competing with reminders. Reduce space at large text, retain motif. | Artwork-only gate, then P01 full composition/contrast matrix. |
| Editor layout | Adopt + Adapt | Clear header, title, compact When/Repeat/Alert/List/Notes sequence, quiet separators. Retain advanced/state/recovery groups. | Recommended separate P06 intake study; no production P01 editor. |
| Separate date / time | Adopt + Adapt | Distinct direct date-only/time-only entry points for When, with real labels. All-day, end, Due/delivery and zone remain separate. Current timed DateField chains two pickers. | P06 cancellation, unchanged instants, gaps/folds, tap-count/native-picker checks. |
| Repeat row | Adopt existing direction | Existing RepeatForm already has a summary, presets and custom sheet. Improve alignment and concise summaries; do not copy away advanced recurrence. | P06 creation/edit scopes, P07 repeat workflows. |
| Alarm / delivery mode | Adapt; Reject binary-only toggle | Recommend existing three-value Alert row/sheet as compact default. Investigate segments/enable-plus-type only against demonstrated common-task benefit. | P06 all modes, linked/independent timing, layout and tap count. |
| Label / List | Adapt; Reject duplicate taxonomy | Rename visual concept to actual List with name/No list and existing picker. Category glyphs and collection names are different concepts. | P05/P06 list identity, scoped return and errors. |
| Notes | Adopt + Adapt | Compact Add notes when empty; existing notes shown on edit. Expanding/collapsing preserves draft; validation reveals errors. | P06 nonempty/long notes, keyboard and cancellation. |
| Save placement | Adapt + Investigate | Keep/restyle existing top-right Save first; filled rounded ≥48 dp control. Compare header versus keyboard-safe bottom in editor study; no duplicate primary actions by default. | P06 one-handed/IME/200%/busy/stale/uncertain/error states. |
| Notification structure | Adapt; Reject custom pastel UI | Standard native template, brand small icon, honest text and native actions. Optional large context icon only if useful/privacy-safe. System owns surfaces. | P03 identity adaptation; P08 actual platform evidence. |
| Full-screen alarm | Adopt + Adapt | Broad upper/side environment; prominent coherent single-member title/time/state/actions. Actual Material Stop/Snooze and unfinished explanation remain. | P01 Compose prototype, P08 production/session/generic/multi-member work. |
| Alarm X / overflow | Reject until semantics defined | No decorative close/menu that implies Stop or adds undefined actions. Activity hiding and silencing are distinct. | A later explicit useful-action proposal would need workflow review. |
| Theme swatches / policies | Adopt + Adapt | Named swatches with non-color selected cue, radio descriptions, independent brightness and palette groups, saving/error feedback. | P04/P09/P10/P11; no settings implementation in P01. |
| Daily mix / weather / extra palettes | Reject | Reference options are not approved product scope; printed values/names do not expand catalog/policies. | Retain P02's existing approved catalog and appearance requirements. |

## Android / Material guidance

Sources consulted on 6 October 2026; these are design guidance, not permission to upgrade
the pinned Compose/RN stack or adopt a new component library.

- Android distinguishes primary navigation from selection components such as chips;
  that supports keeping root destinations and contextual filters separate. This is our
  application of the guidance, not a prescribed Remilo chip list.
  [Android Material components](https://developer.android.com/design/ui/mobile/guides/components/material-overview).
- Official Material Web documents filter chips as selection components. Its web API is
  not recommended as a dependency for RN. [Material chips](https://material-web.dev/components/chip/).
- Use ≥48×48 dp touch bounds, even where the visual icon is 24 dp. Adjacent expanded
  hit regions must not collide. [Android touch targets](https://support.google.com/accessibility/android/answer/7101858?hl=en).
- Android gives text contrast thresholds and explains meaningful accessibility labels;
  apply them to composited backgrounds, not just swatch pairs.
  [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps?hl=en).
- Essential component/state graphics need applicable 3:1 non-text contrast; every purely
  decorative tile edge need not meet that threshold. Do not confuse quiet borders with
  required focus/selection/error indicators.
  [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Compose roles/state descriptions and polite live regions support understandable
  selection and result feedback. Avoid announcing every animation frame or repaint.
  [Compose semantics](https://developer.android.com/develop/ui/compose/accessibility/semantics).

Material's JavaScript-only detailed chips/navigation pages did not provide readable page
content to the research tool. Claims here rely on the accessible official overview and
chip documentation, not unseen guideline text. No numeric card-radius or animation-duration
recommendation is attributed to Material; those are proposed Remilo design choices.

## Completion research and recommendation

**Observed official behavior:** Todoist documents a leading circle that completes and
removes a task, a completed-task display for reopening, and a brief Undo popup for a recurring
task. Its recurrence recovery limits differ from Remilo's durable occurrence model.
[Todoist task help](https://www.todoist.com/help/todoist/features/introduction-to-tasks-080OAXric).
Google Tasks documents a completion control to the left of a task.
[Google Tasks Android help](https://support.google.com/tasks/answer/7675838?co=GENIE.Platform%3DAndroid&hl=en).

**Evidence limit:** these help pages do not document the optimistic transaction order,
animation implementation, persistence-failure handling, announcement timing or reduced-motion
behavior. Do not claim research proves those details. We did not conduct instrumented trials
of either application. Observable UI conventions support the owner's preferred interaction;
reliability and accessibility details are Remilo recommendations requiring local validation.

**Actual repository:** `src/app/index.tsx` awaits native Done, then offers Undo; `useCommand`
invalidates queries after settling. `reopenCompleted` checks captured revision and actual
current state. `Snackbar` uses a polite live region, pauses expiry for screen readers and
respects the Android recommended timeout. `useReducedMotion` already guards layout motion.
Reuse those mechanisms; do not build a JavaScript-only completed-state authority.

**Recommendation:** pressed/pending feedback immediately; confirmed check/optional short
collapse after acknowledgement; no disappearance from a collection that includes completed
items; errors keep content and offer recovery; uncertain operations retain exact identity.
Undo preserves later changes and targets the occurrence, not the newly generated repeat.
Expose Completed/Reopen beyond snackbar expiry. In P05 compare immediate optimistic pending
check versus acknowledgement-first check using injected latency, failure/lost reply, later
edit, rapid taps, filtered views, screen-reader announcements and reduced motion. These
checks establish Remilo behavior; another app's attractive animation does not.

## Android notifications

The official custom-notification guidance recommends standard templates and warns about
restricted space/device variation; apps targeting Android 12+ cannot remove the standard
decoration for a fully custom appearance. Use those limits to preserve reliability and
legibility, not to dismiss the reference's clean hierarchy.
[Android custom-notification guidance](https://developer.android.com/develop/ui/views/notifications/custom-notification).

The platform builder accepts accent color and a large icon, but these APIs do not establish
an identical background/action layout across surfaces. Colorization has special constraints
and is not the ordinary reminder styling strategy. Prefer restrained accent hints and clear
native actions, with real collapsed/expanded/heads-up/lock-screen/OEM checks in P08.
[Notification.Builder color/icon API](https://developer.android.com/reference/android/app/Notification.Builder).
The required small icon/content/action structure remains native.
[Android notification creation](https://developer.android.com/develop/ui/compose/notifications/create-notification).
The official design guide describes a monochrome identity in the status bar, optional
meaningful large icons and manufacturer variation.
[Android notification design](https://developer.android.com/design/ui/mobile/guides/home-screen/notifications).

Actual `AlarmNotifications.kt` already uses standard templates and first-post single-member
Stop/Snooze (multi-member Stop all), private visibility, silent alarm channels and native
PendingIntents. No setColor/large icon is currently applied. P03 owns the future monochrome
Classic adaptation; the current geometric notification mark is not the approved final identity.
P01 makes no notification code/resource/channel changes. Locked/Direct Boot paths must keep
generic content and omit private decoration; no extra credential storage is introduced.

## Milestone reconciliation and remaining decisions

P01 approves the two complementary specifications, then a small artwork-only review, then
two actual review screens. P02 finalizes primitives and the catalog; P05 implements roots,
Agenda and completion; P06 implements editor; P07 details/repeats; P08 native alarm and
notifications; P04/P09 settings/time behavior; P10 classification; P11 launcher appearance.
Their existing hard/integration dependencies remain unchanged.

Recommend the editor study at P06's intake checkpoint. Bringing it into P01 would be an
explicit extra-scope decision, not an inferred requirement. Exact Save placement, delivery
selector alternatives and completion feedback timing require those future workflow trials.
This revision proposes a concrete direction while retaining those bounded decisions.
