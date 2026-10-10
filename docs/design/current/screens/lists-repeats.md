# Lists, Repeats and recurrence controls

The [10 October UX refinement](../ux-refinement.md) removes redundant Open list
menus and simplifies repeat copy while retaining independently changed alerts
when paused/ended. It introduces no recurrence or native lifecycle change.

Revision 5 · 9 October 2026 · **Overall outline, connected grouping and shared neutral list glyph accepted.**

Consolidated 8 October 2026 under A36. Use [the current index](../README.md).

The owner asked to identify the remaining screens and start refinement, using all
images in `docs/design/remilo-r3-atmospheres` for color/style and preserving the
established UX. [A25 intake](../../r7-lists-repeats-intake.json) records that request.
[The coverage map](../../screen-refinement-map.md) identifies the remaining families;
[the fixture brief](../../r7-lists-repeats-fixtures.json) defines the next image review.
R7 identifies the accepted reference batch; TD-03 owns its current implementation.

A26 authorizes the images; [A27](../../approved-ui-r7-outline-acceptance.json) accepts
the overall outline as a sufficient starting template with provisional list icons.
[Twelve associated references](../../remilo-r7-lists-repeats/gallery.html) preserve exact
PNG identities and per-image discrepancy guidance. This records template approval,
not a claim of separate owner review of every raster or immutable pixel acceptance.
The owner allows missing Night/state permutations to inherit the existing theme.

## Connected library items (owner correction, 9 October 2026)

Your lists and the shared management list use 2 dp connected-item seams, 16 dp
outside corners and 4 dp inside corners. The parent is transparent and each
entry paints the theme surface; remove the old continuous white wrapper and
internal 12 dp spacing. Reserve 12 dp for independent groups. Built-in Repeats is
a single filled item with four 16 dp corners. Your lists and shared management
rows use the established neutral `checklist` glyph, 24 dp in the same 40 dp soft
container as ordinary navigation rows, including No list. This identifies the
list role without assigning a category or theme-specific illustration.
Overdue counts remain inside their entry; navigation and More retain separate
targets (rows at least 72 dp, More at least 48 dp), and long names grow/wrap.

## Authority and scope

Use [the canonical R3–R6 direction/corrections](../../approved-ui-r3-r4.md), all eight
[R3 references](../../remilo-r3-atmospheres/gallery.html), and the accepted R4/R5 secondary
screen/keyboard anatomy. Existing [product](../../../product.md), [architecture](../../../architecture.md)
and [workflow](../../../appearance-redesign.md) contracts govern behavior. TD-03 owns
Lists/navigation; TD-03 owns Repeats/family presentation; TD-03 owns recurrence controls.

**9 October owner follow-up:** add a generic leading list icon, superseding the
earlier icon-free implementation decision. Use the existing neutral `checklist`
glyph and shared container treatment, not generated category-specific badges.
Generated icons are preserved in their historical references. Reminder rows/details
retain one neutral `event` glyph. No custom-icon picker or name-based classifier
is introduced.

This refinement makes concrete layout choices; it does not implement app routes,
new scheduling/persistence or migrations. A36 separately fixes global automatic appearance policy.
Bottom roots/origin return, durable Lists, family aggregation and guarded edits
are established UX. The overall new layout/state direction is accepted; exact
production rendering and listed exceptional-state corrections still need actual
acceptance. The beta roots are Agenda / Lists / Completed / Trash; Repeats is a
built-in view secondary to Lists and management remains secondary.

## All eight visual references

Every screen and state below supports every atmosphere in Light and Dark. Brightness
does not rename the scene: Sky Dark still has a daytime cloud/lake scene; Night
Light still has the moon/stars. The scene and shared role values change; content,
component anatomy, role assignment and actions stay identical.

| Atmosphere | Light reference / direction | Dark reference / direction |
|---|---|---|
| Sunrise | [01](../../remilo-r3-atmospheres/01-sunrise-light.png): warm peach/gold sunrise and lake; warm off-white canvas, white raised surfaces; burnt-orange primary with light content. | [02](../../remilo-r3-atmospheres/02-sunrise-dark.png): same sunrise identity, dimmer sky; soft charcoal canvas/raised charcoal; pale apricot primary with dark content. |
| Sky | [03](../../remilo-r3-atmospheres/03-sky-light.png): clear blue sky/clouds, mountain lake and green banks; pale cool-blue canvas/white surfaces; saturated blue primary with light content. | [04](../../remilo-r3-atmospheres/04-sky-dark.png): same daytime scene; soft blue-slate canvas/raised slate; pale sky-blue primary with dark content. |
| Evening | [05](../../remilo-r3-atmospheres/05-evening-light.png): pink/coral sunset, sun/reflection and purple mountains; pale rose/off-white canvas/white surfaces; muted plum primary with light content. | [06](../../remilo-r3-atmospheres/06-evening-dark.png): same sunset identity; soft plum-charcoal canvas/raised plum; pale rose primary with dark content. |
| Night | [07](../../remilo-r3-atmospheres/07-night-light.png): crescent/stars and moonlit blue lake; icy-blue/white canvas and surfaces; deep-blue primary with light content. | [08](../../remilo-r3-atmospheres/08-night-dark.png): same moonlit identity; soft navy-slate canvas/raised navy; pale periwinkle primary with dark content. |

These are qualitative directions, **not** final hex values. Under A24 the full-page
canvas and elevated surfaces reuse the corresponding shared theme roles. Never use
an independent Lists/Repeats black, a sampled PNG shade, or list/family-specific
palette. All pages reuse the selected scene asset and common crop policy. The owner's
[production-art abstraction review](../../production-assets/style-decision.md) is now active,
with final assets requiring individual approval. Structural list/repeat/calendar/zone glyphs and
chevrons are neutral. Primary belongs to actions, selected controls and focus.
Category/status roles remain purposeful and independent of atmosphere.

## Shared geometry, navigation and state treatment

- Review at 360 × 800 dp with real system insets, one readable screen per image.
  Use the shared 200 dp scroll-collapsing browsing opening, including a measured
  nominal 56 dp toolbar. Management uses a compact toolbar. The toolbar title is Lists,
  Repeats, the list name, or the secondary workflow title. Protect its contrast.
  Do not repeat a large Remilo wordmark, page title and motivational slogan above
  a workflow. Art yields before useful content when height/text is constrained.
- Reuse 16 dp gutters/corners, opaque reading surfaces, 16 sp body/value text and
  14 sp support. Secondary titles are approximately 24 sp. Rows grow/wrap; 72 dp
  is only a minimum for a two-line list/library row, not a fixed height. Use 12 dp
  card gaps. Buttons are at least 56 dp; other targets at least 48 dp.
- Lists shows the labeled Agenda / Lists / Completed / Trash bottom bar; Repeats
  is secondary and Back returns to Lists.
  Only the selected destination changes. Root switching replaces context and
  preserves each destination's filter/scroll state; Back returns to Agenda.
  Named-list Agenda and family details are secondary, hide the root bar, and
  return to origin. Transient search/sheets/IME/draft/uncertain guards take priority.
- Root More exposes Settings; global Completed/Trash have their bottom destinations. Named-list More exposes
  Completed in this list / Trash in this list and named-list management. List
  removal is never a reminder-completion or alert-cancellation action.
- Initial loading uses the shared loading treatment, not an empty success state.
  Refresh failure retains known rows with an inline Retry. An acknowledged
  blocked result and an unconfirmed operation are distinct. Disable only actions
  that would conflict with the captured operation; do not silently change its scope.

## A. Lists root and named-list Agenda

**Lists root:** separate **Built-in views → Repeats** from **Your lists → No list**
and the existing durable named-list query order. Repeats stays visible when empty,
with no Rename/Remove and no membership entry. Each opaque row has a wrapped name and navigation chevron.
The later owner instruction resolves A27's provisional list icons in favor of the
shared generic `checklist` glyph. Use the same neutral container for No list and
every named list rather than name-inferred colored badges.
Named lists may also have a separately targeted More menu.
Show a nonzero badge as `2 overdue`, with the complete accessible phrase
`2 overdue occurrences`. Zero may omit the badge; it does not establish that a
list is empty. Do not add total/future/progress counts or completion checkboxes.

Use one Add-style floating action, accessible as **Create list**, matching the
R3 action geometry and shared primary/onPrimary pair. Its plus glyph is paired
with an accessible name/tooltip. Name, support, padding and chevron belong to one
primary navigation Pressable; its decorative chevron is hidden from accessibility.
More remains an independent guarded target of at least 48 dp. Do not add a second Create action above the rows.
Each named-list menu offers Rename list and Remove list. A labeled Manage lists
entry in root More opens the existing explicit management flow. No list has no
Rename/Remove. Reserve actual floating-action/bar/feedback clearance in scrolling.

**Named-list / No list Agenda:** reuse the accepted Agenda rows, sections and
All / Today / Upcoming / Filters semantics with membership fixed to that list.
Search covers the existing title/notes dataset; clearing filters never clears the
fixed membership. Alert anchor drives grouping; No alert uses When/event start.
Unfinished Overdue uses the original configured alert for Alarm/Notification,
When for timed No alert, or the next local midnight after the saved all-day date
in its saved zone. Independent Due does not change that boundary. Cards lead with
device-local alert time or No alert plus When; all-day dates retain their authored
civil date. Follow with consequential Due/delivery and readable repeat metadata.
Keep Event/Due definitions in Details.

One **Add reminder** action preselects this list (or No list), and Save returns to
the originating list with contextual acknowledgement. Completion remains the
leading occurrence control with existing revision-safe Undo; the row opens details
and More opens actions. Completion, row-open and More have separate targets.

**Empty named list:** `No reminders in this list yet.` plus helper `Use + to add a
reminder.` Keep the one Add reminder action and the retained list identity. An
applied-filter empty state instead says `No reminders match` and offers Clear
filters. A query failure never uses either success empty message. If the list was
removed, say `This list was removed. Its reminders are in No list.` and offer Open
No list; do not create a replacement identity or keep Add targeting a removed ID.

## B. Create, rename and remove a list

**Create/Rename:** use an opaque expandable sheet with its workflow title, one
List name field, 60-character existing limit and inline field error. Names are
trimmed; new/renamed names must be case-insensitively unique. Do not rewrite or
merge distinct legacy identities. Structural glyphs remain neutral; the focused
field/caret uses primary. Error text/outline uses the semantic error role.

The sheet has one persistent primary **Create list** / **Rename list** above the
IME, with Cancel as a separate secondary action. Reserve the measured action area;
keep field, caret and helper/error reachable using the canonical one-inset-owner
contract. Closing/cancelling before submission discards this form, not the list.
No extra preference-style Save applies to metadata-only list changes.

Show `Saving…` while pending. On an unconfirmed reply, retain/freeze the exact
name, target/revision and operation identity, show `Save not confirmed. Retry the
same save before leaving.`, and use **Retry save**. Guard dismissal/navigation;
retry must not create another list. An explicit validation rejection unlocks the
form for correction. Rejection of a removed/stale list keeps the attempted text
available for review and does not recreate it automatically.

**Remove confirmation:** title `Remove list?`, name visible, and copy `Reminders in
“Work” move to No list. Their schedules and completion stay the same.` Cancel is
neutral; Remove list uses the labeled destructive semantic treatment. Do not say
Delete reminders or cancel alerts. Removal clears membership across retained
reminders/templates, including Completed/Trash/archived segments, without changing
targets/generations. Pending/unconfirmed removal retains the captured revision/job
and offers **Retry removal**, not a second Remove or a false success toast.

## C. Repeats library

Use the compact themed opening and **Active / Paused / Ended** selection controls.
At narrow widths/large text they wrap with full labels and targets; do not shrink
them to fit. Reuse the existing filter and keyed scroll state. Do not add a new
search engine, fourth status or calendar destination during this refinement.

One opaque family row contains a neutral repeat glyph, full template title, complete
rule summary including interval/end, then **Next** Event date/time for Active or
**Planned** for Paused. Ended uses `No ordinary future dates`. Add `N unfinished`
when nonzero. This count is the native family's retained materialized unfinished
records, which can include future items: **it is not an overdue count or a count
only of earlier items**. One row represents the stable family across segments.

The row opens Repeat details. No family completion circle, Done, Stop, Snooze or
family-wide Postpone belongs here. Do not add an unrelated Add action; reminder
creation still enters through the established editor/Agenda flow.

Paused/Ended show explanatory support that earlier unfinished and independently
scheduled exceptions remain actionable in Agenda. Empty text is state-specific
(`No paused repeats`, for example), not a claim that the app has no reminders.

## D. Repeat family details

Use the shared secondary opening with Back, full title, explicit Active / Paused /
Repeat has ended state, and complete recurrence summary. The information order is:

1. Rule and schedule: event range, alert mode/time where supplied, ending, city/region
   zone or `Follows your device`, and list. Preserve independent timing rather than
   inferring alert time from the Event. Raw zone IDs remain supporting information.
2. Manage repeat: **Pause repeat** or **Resume repeat** and **Edit entire series**,
   using actual current-family eligibility. These are labeled guarded actions, not
   a completion footer. Editing a paused family keeps it paused.
3. At least three native-derived **Next dates** / **Planned dates**, or an honest
   explanation when fewer remain. Each preview shows Event date/time and separate
   alert information, plus consequential zone/clock adjustment when supplied.
4. Initially expanded **Unfinished occurrences**: actual occurrence rows from all
   retained family segments, native query order/pagination, with their own Due/work
   and delivery/next-alert cues. They open ordinary Reminder details, including the
   explicit family link. Do not hide old work behind the future-date preview.

Next/Planned slots are informational: they are not guaranteed materialized occurrence
IDs, and therefore have no Done controls or invented navigable IDs. Actual retained
occurrence rows open Reminder details for Done/Postpone/More under the existing
guards. The current family page supplies row-open only; do not draw an untappable
completion circle or silently add inline family-page mutations to mimic Agenda.
Keep the entire page scrollable without an invented family Done/Save footer.

Paused copy: `Ordinary repeat alerts are paused. Individually changed occurrences
can still have their own alerts.` Planned slots do not claim Scheduled. A postponed
old occurrence may still say Overdue and have a future Scheduled alert. Pause
does not erase it. Resume acknowledgement never guarantees audibility.

Ended copy: `No ordinary future dates.` Retain unresolved occurrence rows; Ended
does not mean completed work. Do not offer Resume for an exhausted family without
eligible ordinary future candidates. Edit appears only where the existing native
current-segment eligibility permits it; no new Restart button is introduced.

## E. Occurrence actions and edit scope

Repeating Reminder details uses the existing **Edit repeating reminder** sheet:

| Choice | Consequence copy / boundary |
|---|---|
| This occurrence | Changes only this occurrence; Repeat stays read-only family context in its editor. |
| This and following | Starts from this occurrence's original scheduled Event/nominal slot. Earlier unfinished/postponed work remains separate. Show the original Event date, not the new postponed alert date. |
| Entire series | Opens the current eligible series editor; existing family/segment preservation applies. Earlier unfinished/postponed occurrences remain retained. |

Tapping a choice opens the corresponding editor draft directly; it does not commit
an edit or require an additional invented confirmation. Only editor Save commits.
No default scope is chosen implicitly. Loading/failed series data keeps occurrence
edit available when eligible, with Retry for family choices. An archived occurrence
offers **This occurrence** plus explanatory current-family access; do not offer
stale This and following/Entire series choices. **Skip this occurrence** remains
an individual More action, not Done or a pause of the family. Trash stays recoverable.

## F. Common Repeat and Custom repeat

Reuse the common choice sheet: Does not repeat, Every day, Weekdays, Every authored
weekday, Every month, Every year, then Custom repeat. Common selection updates the
editor draft under existing conversion guards; it does not schedule before Save.

Custom repeat is an opaque expanded sheet/page within that editor, with a compact
title and nested Back. Order fields as Frequency → interval → conditional weekday /
day / ordinal / month controls → ending → zone → native date preview. Use the
existing Daily, Weekly, Monthly date, Monthly weekday, Last weekday and Yearly rules.
Keep labels/values explicit; weekday controls have full accessible names and
selected indicators as well as primary color.

Intervals are whole numbers 1–999. Day-of-month is 1–31; occurrence count 1–100,000;
end date is on/after the first Event day. At least one weekday is required for a
weekly rule. Monthly ordinal includes First–Fifth/Last; Last weekday means
Monday–Friday. Invalid dates/fifth weekdays/February 29 are skipped and do not
consume count. The native gap/fold/zone policy remains authoritative.

The preview uses the existing native draft projection for at least three dates
when available, with Event and alert separated and honest finite-end/invalid/error
messages. It must correspond to the current form revision and cannot present
stale dates as valid after an invalid change. Preview placement inside Custom is
part of the accepted outline; the existing editor already shows native Next dates.
Actual component placement still needs implementation and verification.
Do not calculate new recurrence dates in JavaScript or label preview dates Scheduled.

Use one persistent **Apply repeat** footer above IME, with Cancel changes secondary.
Apply changes only the parent editor draft; final **Save** commits. Cancel/nested
Back discards unapplied custom changes and returns to common choices; outer Cancel
preserves the parent's previous applied rule. The parent Save does not compete
with the active modal footer. Numeric/ending errors and focused input scroll clear
of footer/IME. Native projection/conversion failure retains the rule draft and Retry;
invalid Apply never mutates the saved series. Editing a paused series stays paused.

## Associated image references

The twelve reference briefs below prioritize normal management plus difficult
states. They are single readable screenshots, not a small-screen comparison board.
All eight R3 appearance references are represented in the first eight candidates;
the supplemental four demonstrate family/scope/recurrence behavior. Fixture clocks
are held independently of the manually selected atmosphere and do not establish
automatic time boundaries.

Lists/Work and family-management examples use separate synthetic dataset snapshots,
not one merged installation: do not add the family examples' overdue records to
the Lists review badges. Actual components always display native-query counts.
Family-detail captures may hold a readable scroll position at Next dates or
Unfinished occurrences, with that position explained beside the image.
Blocks outside the viewport remain scrollable; do not compress the whole family
page into one screenshot or hide the consequential postponed item in R7-08.

| ID | Screen | Reference |
|---|---|---|
| R7-01 | Populated Lists root, long list name, overdue badges | Sunrise Light / R3-01 |
| R7-02 | Create list, keyboard, duplicate-name error | Sunrise Dark / R3-02 |
| R7-03 | Work list Agenda, long overdue title and future postponed alert | Sky Light / R3-03 |
| R7-04 | Remove Work list confirmation, existing reminders preserved | Sky Dark / R3-04 |
| R7-05 | Empty retained Travel list | Evening Light / R3-05 |
| R7-06 | Active Repeats library, long title and complete summaries | Evening Dark / R3-06 |
| R7-07 | Active family details, three informational Next dates | Night Light / R3-07 |
| R7-08 | Paused family, earlier overdue and independently postponed alert | Night Dark / R3-08 |
| R7-09 | Ended family, unresolved occurrence and no Resume | Sunrise Light / R3-01 |
| R7-10 | Occurrence edit scope, original Event boundary after postponement | Sky Dark / R3-04 |
| R7-11 | Custom repeat, valid weekly rule and native date preview | Evening Light / R3-05 |
| R7-12 | Custom repeat, invalid interval with numeric keyboard | Night Dark / R3-08 |

Additional actual-component fixtures cover rename/unconfirmed mutation, removed
list, No list, common choices, archived scope, refresh failure, Include skipped
history access, monthly/annual/end/zone variants and 200% English/Chinese. They need
not each receive a synthetic image to define this shared template.

## Known R3 raster discrepancies to avoid

| Observation | Required resolution for R7 and later screens |
|---|---|
| Sunrise Light selected All and Add show different orange shades. | Both consume the appropriate shared action/selection roles; no per-screen orange sampling. |
| Dark ordinary times/Alarm labels sometimes look blue/violet. | Ordinary metadata uses neutral onSurfaceVariant; only labeled meaning justifies semantic color. |
| Evening Dark's selected navigation pill is much brighter than the others. | Use one shared selection/container/content role pairing and measured contrast; do not create a separate Evening navigation component. |
| Cloud, sun/moon position, scale and crop drift between references. | Reuse selected source assets and a shared crop policy; do not redraw scenery per page. |
| Add approaches the final row's reading area. | Reserve measured FAB/footer/feedback clearance; rows and their targets scroll fully into view. |
| Short sample titles and fixed raster spacing conceal difficult content. | Wrap/grow/scroll real names, rule summaries and status copy; do not shrink type/targets or hide consequential timing. |

[Per-image notes](../../remilo-r7-lists-repeats/review-notes.json) and
[the readable gallery](../../remilo-r7-lists-repeats/gallery.html) record the actual
generation differences. In addition to A27's provisional list icons, resolve:

| Reference | Implementation correction |
|---|---|
| R7-01 Lists | The later owner instruction selects the shared neutral checklist glyph/container. Use shared compact geometry and semantic overdue badges, not the bright generated red/gradient. |
| R7-02 Create + IME | Provisional underlying list glyphs; one measured primary footer and separate Cancel above real IME, with error/caret visible. Platform keyboard colors are not an app requirement. |
| R7-03 Work Agenda | Keep exact authored Event/Due/next-alert values; the repaired client time is 6:00–6:15 PM. Use shared semantic overdue/delivery roles and measured FAB clearance. |
| R7-04 Remove list | Provisional background glyphs; neutral secondary Cancel, semantic destructive Remove, shared modal/scrim/target geometry. Removal still preserves schedules and completion. |
| R7-05 Empty list | Empty-state glyph is provisional and may be omitted with the list-icon decision. Use ordinary 16/14 sp text and compact header rather than enlarged generated empty-state typography. |
| R7-06 Repeats library | Neutral ordinary metadata/glyphs and the shared bottom-bar role pairing; approximate violet tint/capsule spacing is not a separate Evening implementation. |
| R7-07 Active family | Informational date slots remain open-action-free. The partially visible bottom row's generated Wed 7 Oct label is not the fixture's Tue 6 Oct stopped item; use actual native content and real bottom inset. |
| R7-08 Paused family | Use explicit Resume repeat / Edit entire series labels; native query ordering and full occurrence identification. Add real gesture inset despite the missing generated glyph. Overdue and postponed Scheduled remain independent. |
| R7-09 Ended family | Trailing row menus are generated additions to an open-only family view; don't introduce new inline callbacks. Use existing overdue role rather than saturated red. |
| R7-10 Edit scope | Neutral structural/support roles and common Close treatment. Selecting scope opens the draft directly; Close is not a new commit/Continue action. |
| R7-11 Valid custom repeat | Numeric interval is a text field, not a dropdown. Keep >=48 dp weekday targets and 56 dp Apply, native preview, parent-modal relationship and natural scrolling rather than shrinking to show all dates. |
| R7-12 Invalid custom + IME | Readable disabled roles, neutral helper glyph/text, real IME/56 dp reserved footer and focused error/caret. No stale preview or invalid saved mutation. |

Night/state permutations not separately rendered inherit the same established
theme and component rules, as the owner allowed. Approval of the overall outline
does not freeze incidental generated colors, sizes, added icons or omitted controls.

## Verification and handoff boundary

For actual components, compare the same fixture in all four atmospheres × Light/Dark;
measure normal-text ≥4.5:1, qualifying large-text ≥3:1 and required control graphics
≥3:1 on actual surfaces. Check 360 × 800, large text/long English/Chinese, real IME,
TalkBack selection/focus and reachable row/menu/footer targets. Rasters are not proof.

Functional checks preserve list counts/membership/rename/remove, family/segment
identity and eligibility, fixed-list query scopes, original nominal edit boundary,
native preview/date policy, same-operation retries and origin/keyed-state guards.
No list management or visual change may alter registrations/audio. Shared/native
checks run when changed implementation warrants them; this documentation refinement
does not claim runtime/native/physical results or complete TD-03.
