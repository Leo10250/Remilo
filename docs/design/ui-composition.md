# Remilo UI composition language — proposed r2

Artifact: `P01-style-r2`, 6 October 2026. **Proposal awaiting owner approval.**
This is the component/layout companion to [environmental art direction](art-direction.md),
not another product contract. Review the [comparison board](p01-style-review-r2.html),
[pattern evaluation and research](p01-pattern-evaluation.md), [revision record](p01-style-r2.json)
and the [owner's exact correction](references/p01-owner-correction-2026-10-06.md).
It supersedes the incomplete UI coverage of r1; it does not accept r1 artwork or renders.

## 1. Authority, intent and boundaries

**Owner preferences:** friendly separated rounded reminder tiles, near-white surfaces,
compact aligned headers, small meaningful icons, prominent titles with quieter secondary
information, deliberate spacing, simple editor rows, integrated scenery and coordinated
alarm/settings presentation. These qualities apply to the whole UI, not just the background.
Reference B's editor is a primary input. Reference A's botanical alarm establishes the
stronger environmental composition. Neither board is a production behavior specification.

**Existing requirements:** [product](../product.md), [appearance](../appearance-redesign.md),
[architecture](../architecture.md) and A01–A03 in [the ledger](approvals.md) retain authority:
Agenda/Lists/Repeats roots; event grouping; independent Due/delivery; native serialized
mutations, revision/generation guards, Stop ≠ Done, privacy, independent brightness/color
and the exact Classic identity. Proposed UI simplification cannot erase these meanings.

**Recommended design:** the concrete roles, ranges and flows below. These are review starting
points, not accepted production tokens or a fixed pixel-perfect layout. P02 will finalize
reusable primitives. Each later milestone must test its own workflows against this language.

**Open decisions:** final geometry/colors, optional editor study, precise completion feedback
timing, expanded navigation treatment and Save placement after keyboard/one-handed trials.
Approving this brief permits the bounded P01 artwork review; it does not close these later
behavioral decisions or authorize production implementation.

P01 still implements exactly two non-shipping representatives after its design gates:
Sunrise Agenda and actual Compose Meadow Water plants alarm. Editor, notification and
settings patterns are specified here for their existing milestones; they are not implemented
under this revision. No additional palette catalog, classifier, storage, navigation, audio,
scheduling, notification or launcher behavior is introduced.

## 2. Whole-screen audit against the references

The [preserved baseline](../evidence/redesign-p01/baseline-20ea024/manifest.json) renders actual
shared RN rows through the opt-in web preview and actual Compose alarm controls through
Robolectric. Runtime inputs are unchanged at the current clean `4d1059c` starting commit;
these remain attributed `20ea024` captures, not regenerated HEAD/device screenshots.

| Area | Why current output misses the target | Corrective direction |
|---|---|---|
| Agenda header | Brand/search/overflow exist in the review, but a separate date/filter band plus fixed Add and navigation strips consume useful height. At 200%, the fixed header clips the brand in the scrolled capture. | One compact aligned brand/action bar with natural growth; only useful context/filter content below. Measure the entire vertical budget. |
| Cards | Current review combines an 8 dp radius, visible hairline outline and strong 3 dp left accent stripe. Narrow text space between completion/glyph/More makes an ordinary work title wrap. | Softer 14–18 dp candidate corners, consistent padding, tonal separation and a restrained glyph/accent. Remove the review stripe; retain accessible actions. |
| Type/information | Current title/event hierarchy is partly useful, but frequent accessory controls and fragmented secondary lines compete. Production rows expose routine delivery, repeat and state as separate lines. | Primary title, coherent secondary event line, concise contextual metadata, and explicit exception lines when consequential. No fixed two-line cap. |
| Scenery | Footer is low opacity and has its own Add allocation; 200% removes the image. | Atmosphere behind the whole canvas; recognizable landscape around content. Artwork takes no mandatory empty block away from the list. |
| Native alarm | Centered glossy object, left-aligned separated labels and bottom actions leave a large unused middle. The hybrid canvas remains warm instead of full Meadow. | Integrated upper/side foliage, central information hierarchy, one bounded sequence to wide Stop/Snooze and feedback. |
| Large text | RN fixed bands clip or occupy disproportionate height; Compose preserves a fixed decorative allocation. | Natural heading/control growth, reduced decorative space, continuous scroll, accessible controls captured at top and end. |
| Editor (source audit) | Production already has top-right Save and compact Repeat/Alert/List rows. Combined timed When opens date then time; always-visible multiline Notes reserves space. | Restyle existing strengths, direct date/time entry points, collapse only unused Notes, reorder common rows and expose advanced relationships honestly. |
| Settings/notifications | Existing review representations are useful experiments, not actual system notification evidence or accepted appearance settings. | Apply the same type, spacing and state language later; preserve native template limits and distinct settings concepts. |

The editor findings come from `src/app/edit.tsx`, `DateField`, `Page`, `SelectRow`,
`RepeatForm` and `ListPicker`; no new production-editor screenshot is claimed here.
Current component geometry is an implementation starting point, not a justification for
retaining an inferior layout. The reference's small tap areas and faint text are also
not requirements to reproduce.

## 3. Shared component language

Candidate dimensions below are dp/sp at 100% system text. Scale text with system settings;
let component bounds grow. P02 should export role-based values to RN and Compose after
render acceptance, rather than copy scattered literal values to every screen.

| Role | Proposed starting treatment | Constraint |
|---|---|---|
| Spacing | 4/8/12/16/24 dp rhythm; 16 dp phone gutter; 8 dp tile gaps; 12–16 dp tile inset | Small-screen density comes from removing redundant bands, not reducing essential text or touch bounds. |
| Header | 24 sp semibold Remilo; secondary-page heading 20 sp; baseline-aligned actions; 56 dp minimum with natural growth | Search/overflow targets ≥48×48; reflow at 200%, no fixed-height clipping. |
| Reminder title | 16 sp medium/semibold, dark ink, natural wrapping | Do not truncate essential titles to preserve a picture or fixed row height. |
| Secondary / metadata | 14 sp secondary, 12–14 sp compact contextual metadata; around 1.35–1.45 line height | Small text still needs normal-text contrast; consequential information should use readable 14 sp roles. |
| Tile | Near-white opaque light surface; opaque dark equivalent; 14–18 dp corners | Quiet tonal edge or very restrained shadow. An essential state/affordance gets its own contrast-safe marker. No heavy border or category stripe as default. |
| Icons | 18–20 dp meaningful metadata glyphs; 24 dp action glyphs; consistent bundled symbol family | No emoji-style decoration as an action substitute. Classification remains authored fixtures until P10. |
| Completion | 22–24 dp visible circle inside ≥48×48 target, leading and aligned to content | Distinct from row-open and More; targets never overlap. Completed state includes shape/check and semantics. |
| Buttons | Filled primary, outlined/tonal secondary; rounded/pill actions; 48 dp minimum | Text can wrap and buttons grow. Actual Material Stop/Snooze remain controls. |
| Dividers | Subtle tonal separators for related form/settings rows | Not a decorative border around every field/card; focus/error/selection indicators remain explicit. |
| Feedback | Inline contextual error/retry; concise polite confirmation with accessible Undo where applicable | Preserve known content, operation identity and the distinction between pending, confirmed and uncertain. |

Dark mode keeps the composition and hierarchy with intentional dark roles; do not apply
a translucent black overlay to a flattened UI. Scenery is never the sole carrier of
selection, completion, overdue or ringing state. Stable placeholders retain action geometry
while loading. Disabled/busy states include semantic state and, where necessary, a reason.

## 4. Agenda composition, navigation and card information

### Header and destinations

Use Remilo at left, Search and Overflow at right. On a named list use its name and contextual
Back; retain origin. The overflow provides existing Completed/Trash/Settings destinations.
Filtering remains discoverable: a compact filter affordance/context strip when needed.
Avoid cramming Search, Filter and Overflow into a narrow bar alongside enlarged text.
If an extra action must move into the context row or menu, label it and measure discoverability.

Keep approved labeled bottom roots **Agenda / Lists / Repeats**. Reference chips are filters
inside a destination, not replacement tabs. Proposed resting Agenda does not add a permanent
four-chip time strip: All/Today/Upcoming/Later have not been approved or defined. Use chips
for existing active List, Overdue or Alert problems filters and removable selections, plus
an explicit filter entry. “All” means no filters only if implemented with that exact meaning.
Avoid duplicate destination and filter navigation. Search, sheet, draft and uncertain-action
guards precede Back/root switching; production changes belong to P05.

Keep one Add action, proposed floating above the root navigation, inside safe insets.
Reserve only enough end-of-list clearance to scroll the last tile above Add/feedback/nav.
Do not allocate a separate 80 dp decorative/Add row. Navigation labels remain visible and
can grow at 200%; compact chips can wrap or use a discoverable scroll region.

### Tile content hierarchy

1. Leading completion circle, title, optional restrained meaningful category glyph.
2. Secondary event date/time or range using native-derived instants and saved zone. A group
   already establishes Today/Tomorrow; omit only redundant date wording, not the event range.
3. Compact list/repeat context when relevant; expose the full recurrence rule in details.
4. An explicit exception line for independent Due, Overdue, changed/postponed delivery,
   blocked/missed/interrupted/ringing state or changed occurrence. Use icon plus wording.

Ordinary coincident event/Due/alarm needs no repeated identical timestamp. The mode is still
understandable through a labeled semantic icon/summary. Notification and No alert remain
distinct. Changed ringing/postponed delivery gets its own labeled target; it does not replace
the event time. Recurrence and exceptions remain discoverable, including in the accessibility
summary; they must not require opening details to discover a time-critical problem.

More actions keep a visible accessible entry; no gesture-only replacement. Evaluate a quieter
trailing control and padding against title width before dropping useful actions. Normal tiles
may be around 72–88 dp, but content determines height. Overdue/long/changed-delivery cases
will be taller. Dense should mean coherent, not incomplete.

### Groups and counts

Retain Today/Tomorrow and required Earlier/Overdue groups according to native query semantics.
Align modest counts at the trailing edge with a shared type rhythm. Counts are the filtered
group totals before pagination, not loaded-page lengths or invented future recurrence totals.
Collapsed group count is unchanged. Empty, completed and list-scoped views keep their actual
collection semantics. Derive fixture counts from the same data selector used by both variants.
Use existing production aggregate contracts; do not implement a second UI query authority.

### Completion feedback recommendation (behavior still to validate in P05)

The owner's immediate check → subtle confirmation → removal → Undo proposal is attractive.
Official Todoist/Google Tasks evidence supports leading completion controls and completed
visibility; it does **not** establish their persistence-failure or animation internals.
See [research limits](p01-pattern-evaluation.md#completion-research-and-recommendation).

Recommended first implementation: immediate pressed/pending feedback on the captured occurrence;
after native acknowledgement, show the check, brief optional confirmation and collapse the
tile only if the current collection excludes completed items. Preserve the completed tile in
a completed/history collection. Do not present an uncertain mutation as durably completed.
An optimistic check could be trialed later if visibly pending and rollback/reconciliation are
verified; it is not a P01 product decision.

Use the existing revision-safe Reopen Undo and captured operation identity. Failed completion
keeps/restores the tile and offers understandable retry; an uncertain response uses the same
command identity and does not enable a conflicting action. Undo after a later edit must preserve
that edit and explain why reversal is unavailable. Do not copy another app's recurring-task
Undo window over Remilo's occurrence identities. Counts change from the confirmed collection.

Candidate motion is a short 120–180 ms confirmation/collapse with no bounce, glitter or scene
animation. Reduced motion removes motion but preserves confirmation and Undo. A polite
announcement identifies the task and result once; retain a sensible next-item/group focus
without losing the Undo action. Preserve existing screen-reader timeout behavior; Undo must
also remain accessible through Completed/Reopen after the transient message expires.
P01 can demonstrate memory-only feedback; durable workflow validation belongs to P05.

## 5. Editor language and bounded study recommendation

This guides P06 and P07, not a third implementation authorized by P01. Production already
has Save in the header, Repeat summarized into a sheet, and a three-mode Alert selector.
Keep those strengths. The strongest opportunities are alignment, row ordering, direct
date/time access, compact unused Notes and quieter form grouping.

Recommended common order: **Title → When (date / time) → Repeat → Alert → List → Notes**.
Use a simple rounded title field and aligned icon/label/value rows with subtle dividers.
Allow value/label stacking at 200% and with long Chinese/English. Use a consistent clear
heading (Add reminder/Edit reminder/Edit repeat/Edit following, according to actual scope).
Hide root navigation on this route.

| Control | Recommendation and preservation rule |
|---|---|
| Date / time | Separate ≥48 dp controls for the event's date and time, with explicit When labeling. Time opens the time picker directly. Date opens only date. Cancel commits neither partial picker nor preview. Use native civil conversion, keep untouched components/instants and gap/fold handling; a later-fold instant must survive unrelated edits. |
| All day / zones | All-day shows a date and an explicit All day state instead of a misleading time. Advanced end/Due/delivery and pinned/floating zone controls remain accessible. Different dates/zones are labeled; two anonymous timestamps cannot stand for three meanings. |
| Repeat | Retain concise summary plus quick common presets and Custom drill-in. Existing `RepeatForm` already follows this structure. Preserve scopes, limits, previews, warnings and nominal identities; no recurrence engine rewrite. |
| Alert | Start with compact current-value row **Alarm / Notification / No alert**, opening a three-choice sheet. It uses one entry plus one choice, without ambiguous toggle memory or a permanent segmented row consuming title width. Test against direct segments before final P06 acceptance; switching modes must not silently reset independent timing. |
| Alternative alert toggle | Investigate only if enable/disable plus retained type is clearer in trials. It adds two state dimensions and risks confusing No alert with Notification; a binary Alarm switch alone is rejected. |
| List | Use **List**, selected durable list name or No list, and drill-in to existing picker. Do not introduce Label/category as a duplicate user taxonomy. List colors supplement names. |
| Notes | Empty notes begin as Add notes row; expand on request. Existing/nonempty notes show immediately during edit, preserving all content. Error forces affected control open. Collapse never clears the draft. |
| Advanced | Schedule options and Alarm options remain distinct. Inline summaries disclose independent Due/delivery/all-day policy. Sound selection is separate from Play/Stop preview ownership. Warnings and stale/uncertain review remain prominent. |
| Save | Restyle the existing header Save as a clear filled rounded action with ≥48 dp target. Start with one primary Save, not two permanently competing actions. At 200% allow header growth/stacking. Test header versus keyboard-safe bottom placement for reachability before P06's flow gate. |

Save states must remain stable: enabled, disabled with reason, Saving/Updating, stale Review,
uncertain Retry, confirmed acknowledgement and failure. Keyboard dismissal is not Save;
Back retains existing discard/uncertain guards. No autosave behavior is introduced.
Scenery occupies exposed lower/side space without a fixed blank form region and recedes when
the keyboard opens. Browser keyboard proxies cannot prove Android IME behavior.

**Recommend a separate editor design checkpoint at P06 intake**, before production conversion:
one Sunrise non-shipping layout study using the actual editor/control composition, standard
and nonempty-notes/advanced states at 360×800, 200% text and keyboard shown/hidden.
Compare header Save versus bottom Save with common-task tap counts and one-handed reach.
This is not executed now and adds no prerequisite to P01. If the owner wants it in P01,
explicitly authorize that bounded extra prototype separately; it must not alter draft/engine
behavior or become a full editor implementation. This brief already guides it without waiting
for all theme variants.

## 6. Native alarm composition

The primary scene is the full Meadow canvas, not a rounded card containing the whole alarm.
Edge-rooted foliage shapes the upper and side environment. A central quiet region supports
title → current ringing delivery/time → ringing state → filled Stop → outlined Snooze
→ unfinished explanation/error. Center the single-member information and actions as one
sequence; use restrained brand/support text. Do not stretch the gap between title and actions
to fill the available height. Balanced scenery and hierarchy matter together.

Start with 28 sp title, 22–24 sp time, 14–16 sp support; 8–12 dp information gaps,
20–28 dp before actions, 12 dp between wide buttons. Retain current 64 dp minimum Stop/Snooze
heights, natural growth and clear disabled/busy states. “Current ringing delivery” can be
visually quieter but stays explicit. Differing event/Due information remains labeled.
Keep “Stop leaves the reminder unfinished.” Actions use the captured record/generation.

Do not copy the reference X or overflow without a defined useful action: dismissing the
activity is not Stop, and hiding the screen cannot imply silencing. Preserve native confirmed
dismissal, multi-member actions, retry and safe generic-before-unlock behavior. Membership
changes retain the initial scene per session; missing assets still leave readable controls.
The optional presentation slot may rearrange actual `AlarmControlsScreen` information,
action and feedback blocks, preserving production defaults/callbacks. No parallel alarm
screen or duplicated action logic is acceptable.

## 7. Notifications and appearance settings

Notifications use Android's standard templates, native text/actions and a small monochrome
brand mark adapted under P03. The mockup's category bell/leaf does not replace Remilo identity.
Consider a decorative large icon only later if it adds useful context, is privacy-safe,
fits platform presentation and does not complicate native startup. It is optional, not
necessary for P01 or required on every notification surface.

An accent color is a platform hint, not a promise of a pastel card/background or pill buttons.
Do not add custom RemoteViews or colorized backgrounds to imitate the board. Android 12+
adds standard decoration even to custom layouts. Preserve first-post native Stop/Snooze,
multi-member Stop all, generation guards, locked/Direct Boot generic content and silent
ringing channels whose audio belongs to the native service. Ordinary Notification mode
retains its own current actions; do not give every notification an invented Stop action.
P08 verifies collapsed/expanded/heads-up/lock-screen/OEM behavior separately.
See [official-source findings](p01-pattern-evaluation.md#android-notifications).

Appearance settings use named swatches, a visible check/selection ring and semantic selected
state, radio-style policy choices with concise subtitles, aligned rows and clear grouping.
Keep brightness **System / Light / Dark** distinct from palette and automatic behavior.
Fixed/time/smart policy, manual appearance and launcher matching retain their approved
ownership/precedence. Swatches can preview choices immediately but durable selection must
honestly show saving/failure and rollback. No Daily mix, weather policy, extra palette names
or new appearance data fields are adopted from the mockups. Implementation belongs to
P04/P09/P10/P11; palette/catalog work belongs to P02.

## 8. Whole-UI verification and acceptance

Use the common [art-direction render matrix](art-direction.md#7-render-verification) and
identical data/selectors for baseline/corrected variants. Compare four columns: unmodified
reference, attributed current Remilo, actual corrected component render when implemented,
and explanation. Keep equal display width and aspect ratio; labels live outside screen images.
Reference times/content differ and must be identified. Today no corrected-render column exists;
documentation diagrams are not proof of functioning UI.

Score every comparison across **illustration, layout, UX and technical correctness**:

- Illustration: vocabulary, layering, atmosphere, crop, environment and light/dark treatment.
- Layout: type, hierarchy, alignment, spacing, corner shape, component density, header,
  action placement and balance. Record useful content viewport and actual row/action bounds.
- UX: scanning, state comprehension, discoverability, common tap counts, errors/Undo,
  focus order, scroll reachability and reduced motion; explain every adaptation to references.
- Technical: actual RN/Compose components, unchanged fixture semantics and native defaults,
  realistic dp dimensions/insets, captured action identity, review isolation and fallback.

Do not compare visible-row counts across different data/title lengths as a usability score.
Measure the same controlled fixtures before/after, including normal and exceptional content.
Retain system scaling; no essential title shrinking/clipping. Touch targets ≥48×48 dp,
no collisions, contrast measured on actual composites (normal ≥4.5:1; large ≥3:1; applicable
essential non-text indicators ≥3:1), grayscale state comprehension, labels/roles/selected/
busy states and decorative exclusion. Physical TalkBack, Android keyboard/system notification
surfaces and alarm reliability remain explicit device/P12 evidence.

Owner gates remain separate: **refined specification → artwork-only candidates → actual
RN/Compose screens**. Approving one does not approve the next. Resolve conditions and re-review
material changes. No test suite, attractive image or agent assessment establishes acceptance.
