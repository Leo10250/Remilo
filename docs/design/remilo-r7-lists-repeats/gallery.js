"use strict";
const screens = [
  {
    "id": "R7-01",
    "file": "01-lists-sunrise-light.png",
    "width": 841,
    "height": 1871,
    "sha256": "10c7b5ac94ebe3fc3b290dc7bb4de8aee042651460fc9bb3c6abdf22fc7bce97",
    "effectiveHeightAt360": 800.9,
    "atmosphere": "Sunrise",
    "appearance": "Light",
    "referenceId": "R3-01",
    "title": "Lists root — populated · Sunrise / Light",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Lists root — populated using the matching Sunrise Light R3 atmosphere.",
    "review": [
      "No list fixed entry",
      "Work · 2 overdue",
      "Home · 1 overdue",
      "Wrapped long list name",
      "One Add-style action; explicit per-list More"
    ],
    "discrepancies": [
      "Owner note (A27): decorative list icons vary in presence/style across generated screens. They are provisional; the owner currently favors omitting them. Raise the decision during implementation. There is no custom list-icon creation/selection feature in scope.",
      "The selected repair uses one generic neutral list glyph; earlier output invented name-based colored icons. Do not implement automatic list-category icons from those discarded pixels.",
      "The scenic opening and row/title metrics remain taller/larger than the compact specification. Use the common 96 dp opening below the status inset, 16 sp values/14 sp support and measured 48 dp row-menu targets.",
      "Overdue badges are unusually bright red and the Add has a shiny gradient. Use the existing shared overdue semantic role and matching Sunrise primary/onPrimary tokens; colors are not sampled from this PNG."
    ]
  },
  {
    "id": "R7-02",
    "file": "02-create-list-error-sunrise-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "d0e5cc922dcf629eff173089d97bf37e588a97cc8931d72078086844f15f121d",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sunrise",
    "appearance": "Dark",
    "referenceId": "R3-02",
    "title": "Create list — duplicate name and keyboard · Sunrise / Dark",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Create list — duplicate name and keyboard using the matching Sunrise Dark R3 atmosphere.",
    "review": [
      "Use error only after explicit rejection; form is editable. Rename and unconfirmed Save are additional component fixtures."
    ],
    "discrepancies": [
      "Owner note (A27): list identity glyphs visible behind this sheet are provisional. The owner favors omitting decorative list icons and wants the decision raised during implementation; no icon picker is authorized.",
      "The repaired footer is stacked above the keyboard, but generated button heights/type and spacing are approximate. Implement one measured 56 dp primary slot, a separate accessible Cancel, real IME insets and reachable field/caret/error.",
      "The backdrop crop and sheet height are larger than the shared compact layout. Use the normal Lists root/scrim; the rejected duplicate remains editable, while an uncertain save has separate captured-job retry/close guards.",
      "The keyboard's apricot Enter key is synthetic platform appearance, not a requirement to theme Android's IME."
    ]
  },
  {
    "id": "R7-03",
    "file": "03-work-agenda-sky-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "177669fce02cc79720e64820ecb4c848bf728fb49bf987e4720fdd269216a708",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sky",
    "appearance": "Light",
    "referenceId": "R3-03",
    "title": "Work list Agenda — dense overdue/postponed · Sky / Light",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Work list Agenda — dense overdue/postponed using the matching Sky Light R3 atmosphere.",
    "review": [
      "Complete long title wraps",
      "Overdue from original Due",
      "Future postponed alert remains separate",
      "List membership cannot be cleared by filters",
      "Lower rows may scroll; never shrink text/targets"
    ],
    "discrepancies": [
      "Reminder category badges are distinct from decorative list identity icons. A27's open icon decision applies to the latter; do not infer a custom Work-list icon from these document/call badges.",
      "The opening remains taller than the 96 dp secondary budget. Use the shared crop/toolbar and natural scrolling rather than copying raster geometry.",
      "Due/Overdue and Missed use saturated generated red. Apply their distinct established semantic roles with explicit labels; a future postponed alert never clears overdue work.",
      "The repaired client time is 6:00–6:15 PM. Tomorrow's Project review is below this capture; the authored fixture remains authoritative for all rows/counts.",
      "FAB clearance remains approximate near the last card. Reserve measured action/safe-area space and verify every row/menu can scroll fully clear of it."
    ]
  },
  {
    "id": "R7-04",
    "file": "04-remove-list-sky-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "fef07fc9d4225d7ae2a13c8f5bb733ea3fa2d78b5fbd0d3f93bac7587824a7d9",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sky",
    "appearance": "Dark",
    "referenceId": "R3-04",
    "title": "Remove Work list — confirmation · Sky / Dark",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Remove Work list — confirmation using the matching Sky Dark R3 atmosphere.",
    "review": [
      "Use the existing guarded workflow and matching global theme."
    ],
    "discrepancies": [
      "Owner note (A27): underlying list glyphs are provisional; likely omit decorative list icons, with the choice raised during implementation. No custom list-icon selector exists.",
      "Cancel is tinted blue and the Remove button is very bright. Cancel uses the standard secondary/neutral role and Remove the labeled destructive role; do not sample per-screen colors.",
      "Dialog corners, alignment, button heights and dim scrim differ from other sheets. Use shared modal components and real 48 dp or greater targets on matching Sky Dark raised surfaces.",
      "Removal affects the list identity/membership only. Reminders move to No list with schedules/completion preserved; this image does not authorize reminder deletion or cancellation."
    ]
  },
  {
    "id": "R7-05",
    "file": "05-empty-list-evening-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "c0116cab69351e28d79c9d02a22c3ffbf5282f132fb7375109cd0c457b67ffca",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Evening",
    "appearance": "Light",
    "referenceId": "R3-05",
    "title": "Travel list — retained empty · Evening / Light",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Travel list — retained empty using the matching Evening Light R3 atmosphere.",
    "review": [
      "Use the existing guarded workflow and matching global theme."
    ],
    "discrepancies": [
      "Owner note (A27): the generic empty-list glyph is provisional. Decorative list identity icons are not a custom feature; the owner favors omission, with the decision raised during implementation.",
      "Generated opening remains about 175–180dp including status bar, taller than the specified compact scenic opening. Resolution: Implement the shared compact 96dp scenic opening below the status inset with a56dp toolbar and22sp title. Crop bundled artwork; do not adopt this taller PNG geometry.",
      "Empty-state message is visually around20sp and more emphatic than the16sp body specification. Resolution: Use the shared16sp body/14sp support tokens and an ordinary neutral32dp empty glyph only if retained after the implementation decision. Retain honest empty space and single Add reminder FAB.",
      "Raster color/gradient and FAB sheen are approximations of R3 Evening Light. Resolution: Consume shared Evening Light semantic canvas/surface/primary roles and bundled art, never PNG-sampled colors or a page-specific palette."
    ]
  },
  {
    "id": "R7-06",
    "file": "06-repeats-evening-dark.png",
    "width": 841,
    "height": 1871,
    "sha256": "c47ef57271cf56b1b87148ac152d4ef087c8ac216497d2bb05bd1a29513368a8",
    "effectiveHeightAt360": 800.9,
    "atmosphere": "Evening",
    "appearance": "Dark",
    "referenceId": "R3-06",
    "title": "Repeats library — Active · Evening / Dark",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Repeats library — Active using the matching Evening Dark R3 atmosphere.",
    "review": [
      "Long team-family title",
      "Complete rule summary",
      "Next Event date",
      "N unfinished; not N overdue",
      "Paused/Ended choices"
    ],
    "discrepancies": [
      "Corrected image is841×1871, one pixel taller than nominal841×1870. The scenic opening still exceeds the96dp compact specification. Resolution: Actual layout must use360×800dp device-proportional metrics and shared compact header; the one-pixel raster difference does not define component size.",
      "Repeat metadata and icons have a slight violet tint inherited from generated Dark reference. Resolution: All structural repeat glyphs, chevrons and ordinary metadata consume neutral onSurface/onSurfaceVariant roles. Rose is reserved for Active selection and selected Repeats destination.",
      "Selected Repeats icon capsule and text fit the intended role but exact corners/spacing are approximate. Resolution: Use the same shared three-destination bar component as Agenda/Lists with native bottom inset and measured body clearance."
    ]
  },
  {
    "id": "R7-07",
    "file": "07-active-family-night-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "8910a93ddf1a628eeff3e944a233d5f6942d9cc4d56bb4212b7ec13c4868b701",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Night",
    "appearance": "Light",
    "referenceId": "R3-07",
    "title": "Active repeat family details · Night / Light",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Active repeat family details using the matching Night Light R3 atmosphere.",
    "review": [
      "Event and alert separated",
      "Rule/ending/zone/list",
      "Actual retained occurrence area below previews",
      "Readable scroll position around Next dates; surrounding rule/schedule may extend above or below viewport. Do not compress all blocks into one screenshot."
    ],
    "discrepancies": [
      "Color repair neutralized arbitrary blue/purple Event/Alarm/date-preview icons and changed Pause repeat to the matching deep-blue action role. Resolution: Preserve neutral structural/info icons in implementation, category identity does not belong to these schedule rows. Actions consume shared Night Light primary roles.",
      "The scenic opening is taller than the compact96dp specification, and title/schedule/nextdates were all shown in one long viewport instead of a tighter scroll capture. Resolution: Use the compact header and natural scrolling, preserving24sp wrapped familytitle,16sp values,14sp support without shrinking to fit.",
      "Bottom unfinished occurrence is partially visible beneath the gesture bar region. Resolution: This is a scroll boundary, not a complete row acceptance example. Apply native bottom safe inset and content padding so a scrolled-to actual row is fully readable and reachable.",
      "Pause repeat appears filled while Edit entire series is a lighter action; exact action prominence and icon hues remain generated approximations. Resolution: Use the established repeat-management action hierarchy and shared Night Light tokens, with label-based meaning; do not infer new state from fill alone.",
      "The partially visible bottom row says Wed 7 Oct; the fixture's retained earlier item is Tue 6 Oct with a stopped alert. Use exact native/fixture occurrence content and delivery state; the raster is not data authority or permission to replay an elapsed alert."
    ]
  },
  {
    "id": "R7-08",
    "file": "08-paused-family-night-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "8f7519b8ceb170c9b84f386f7a49148a60e7ba640e39f4cfbd4f1f6a3d4cba0e",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Night",
    "appearance": "Dark",
    "referenceId": "R3-08",
    "title": "Paused family — overdue/postponed exception · Night / Dark",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Paused family — overdue/postponed exception using the matching Night Dark R3 atmosphere.",
    "review": [
      "Paused ordinary-alert helper",
      "Expanded Unfinished occurrences",
      "Original Event and Due still overdue",
      "Tomorrow 2 PM postponed alert still Scheduled",
      "Older previous-segment occurrence retained",
      "Scroll to the expanded Unfinished occurrences section so the postponed overdue item is readable; Planned dates may be above viewport. Normal shared toolbar/art remain. Explain captured scroll beside the future image."
    ],
    "discrepancies": [
      "Repair replaced title-inferred green leaf/category badges with neutral repeat glyphs and reduced arbitrary selection coloring on status metadata. Resolution: Family/occurrence structural identity stays neutral. Periwinkle is for actual Resume action; explicit overdue semantics retain a dedicated warning/error role.",
      "Header and familycontextcard remain larger than the compact/scrolled fixture requests. Resolution: Implement compact96dp scenic opening and permit scrolled context so the consequential retained postponed occurrence remains readable; do not treat all blocks as requiring one viewport.",
      "Final color repair omitted the Android gesture-bar glyph shown in the initial candidate. Resolution: Native system insets remain required. This omission is an image-generation discrepancy; all content must clear the real navigation/gesture inset.",
      "Only the first retained item repeats the full title; latter occurrence rows show date/status context. Resolution: Actual shared occurrence-row structure and screen-reader labels must identify the occurrence independently; repetition/compact display follows the spec and data, not raster simplification.",
      "Resume and Edit repeat are shortened generated labels. Use Resume repeat and Edit entire series so scope remains explicit. Retained rows follow native query ordering; their illustrated emphasis does not introduce a new sort."
    ]
  },
  {
    "id": "R7-09",
    "file": "09-ended-family-sunrise-light.png",
    "width": 841,
    "height": 1871,
    "sha256": "934aec27b4e6f0ab3f0eb6d3eaf11a84d0b6cb567de081014efb9bd3af89770e",
    "effectiveHeightAt360": 800.9,
    "atmosphere": "Sunrise",
    "appearance": "Light",
    "referenceId": "R3-01",
    "title": "Ended family — unresolved work · Sunrise / Light",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Ended family — unresolved work using the matching Sunrise Light R3 atmosphere.",
    "review": [
      "Repeat has ended",
      "No ordinary future dates",
      "Two actual unresolved occurrence rows",
      "No Resume or family Done",
      "Edit entire series only if current native segment eligibility allows it.",
      "Scroll position showing ended state and actual unresolved work; normal shared toolbar/art. No fabricated family completion footer."
    ],
    "discrepancies": [
      "Scenic opening remains about 140dp below the status bar rather than the specified compact 96dp, and card padding/title weight are larger than ordinary production components. Resolution: Use the R7 compact scenic opening at approximately 96dp plus status inset, 56dp toolbar, 16dp gutters/corners and shared type scale. Reflow content and retain scrolling rather than treating generated spacing as pixel geometry.",
      "Occurrence rows show trailing overflow dots, while this fixture specifies open-only rows without inline completion. Overdue text is a brighter red than a calibrated shared semantic token. Resolution: Render the occurrence row with its specified open-details affordance; omit extra per-row actions for this fixture. Keep neutral calendar icons and use shared semantic overdue/onSurface roles, independent of Sunrise primary."
    ]
  },
  {
    "id": "R7-10",
    "file": "10-edit-scope-sky-dark.png",
    "width": 841,
    "height": 1871,
    "sha256": "5cec96e81334c601b3ca77432aa4208d42f231234f42e7818a214e332819cb0d",
    "effectiveHeightAt360": 800.9,
    "atmosphere": "Sky",
    "appearance": "Dark",
    "referenceId": "R3-04",
    "title": "Edit repeating reminder — scope after postponement · Sky / Dark",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Edit repeating reminder — scope after postponement using the matching Sky Dark R3 atmosphere.",
    "review": [
      "Show a non-archived eligible series context for all three choices. Archived variant allows individual edit/current-family access only."
    ],
    "discrepancies": [
      "The sheet's icons, date support text, chevrons and helper text retain a pale blue tint despite the neutral structural/support role rule; Close is shown as a large rounded full-width action. Resolution: Bind structural glyphs, metadata and dismiss affordances to neutral onSurface/onSurfaceVariant roles. Theme primary is reserved for real selection/action/focus. The scope rows open a draft without saving; dismiss remains a neutral Close affordance and no Apply/Save/Continue action is introduced.",
      "Generated scenic opening and modal proportions are approximate; the three choices are visible and none is selected. Resolution: Use the shared 96dp compact scenic opening and an accessible sheet sizing/scroll policy with 48dp or greater hit regions. Preserve separate original event and postponed alert context, and keep earlier unfinished retention semantics."
    ]
  },
  {
    "id": "R7-11",
    "file": "11-custom-repeat-evening-light.png",
    "width": 842,
    "height": 1869,
    "sha256": "9b64b9432da969df561c74084d412f6c79aefbb193d1ccc5d987eda60d55ff47",
    "effectiveHeightAt360": 799.1,
    "atmosphere": "Evening",
    "appearance": "Light",
    "referenceId": "R3-05",
    "title": "Custom repeat — valid weekly draft · Evening / Light",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Custom repeat — valid weekly draft using the matching Evening Light R3 atmosphere.",
    "review": [
      "Every 2 weeks",
      "Monday/Wednesday/Friday selected with accessible indicators",
      "Never ending",
      "Follows your device",
      "Three native-projection preview dates",
      "Apply is draft only; Save commits"
    ],
    "discrepancies": [
      "The custom repeat image resembles a full secondary page and does not show a recognisable dimmed parent Edit repeat behind its expanded editor; scenic opening remains larger than specified. Resolution: Implement the specified expanded modal/editor route with parent Save hidden or obscured while active, opaque matching themed surface and a normal dim scrim if parent pixels are visible. Use compact 96dp scenery and the common toolbar.",
      "The weekday chips and Apply/Cancel controls look shorter than the specified hit regions; helper/body text appears somewhat compressed to display all preview dates. Resolution: Use 48dp interactive hit targets and a 56dp full-width primary action. Keep 16sp body/value and 14sp support with measured footer clearance; let the body scroll, including partial preview capture, rather than reducing type or action height."
    ]
  },
  {
    "id": "R7-12",
    "file": "12-repeat-error-keyboard-night-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "68ddf27bc340896fb06d464220e33413098ab0da45ef8a9c1e090825499bbc18",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Night",
    "appearance": "Dark",
    "referenceId": "R3-08",
    "title": "Custom repeat — invalid interval and keyboard · Night / Dark",
    "status": "Associated reference · overall UI/UX outline approved (A27); pixels approximate",
    "intent": "Custom repeat — invalid interval and keyboard using the matching Night Dark R3 atmosphere.",
    "review": [
      "Repeat every (weeks) = 0",
      "Inline error above numeric IME",
      "Footer reserved above IME",
      "No valid-looking stale preview",
      "No saved-series mutation"
    ],
    "discrepancies": [
      "The screenshot retains a tinted preview/calendar helper glyph and support text. The disabled Apply repeat still uses a muted primary-like fill with a dark low-contrast label. Resolution: Use neutral structural/support roles and a clearly disabled surface/content treatment with a readable label. Reserve periwinkle for actual focus, selected weekdays and actionable controls; invalid Apply stays disabled and never mutates saved state.",
      "The repair correctly stacks full-width Apply/Cancel above the numeric keyboard, but the buttons are visually shorter than 56dp and the keyboard style is synthetic. The modal backdrop is not distinctly visible. Resolution: Use an actual platform IME; one inset owner, measured scroll clearance and focused-field/error visibility. Apply gets a real 56dp full-width slot and Cancel its own accessible hit region above the keyboard. Parent Save and root navigation remain unavailable while this editor is active, and the scrollable body may hide lower optional controls instead of shrinking."
    ]
  }
];
const byId = id => document.getElementById(id);
const slugOf = screen => screen.file.replace(/\.png$/i, "");
let selected = 0;
const select = byId("screen-select");
for (const screen of screens) {
  const option = document.createElement("option");
  option.value = slugOf(screen);
  option.textContent = screen.id + " · " + screen.title;
  select.appendChild(option);
}
function renderList(id, lines) {
  const list = byId(id);
  list.replaceChildren();
  for (const line of lines || []) {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  }
}
function applyScale() {
  const value = byId("scale-select").value;
  const width = value === "original" ? (screens[selected]?.width || 841) : Number(value);
  document.documentElement.style.setProperty("--preview-width", width + "px");
}
function render(index, updateHash = true) {
  if (!screens.length) {
    select.disabled = true;
    byId("previous").disabled = true;
    byId("next").disabled = true;
    byId("position").textContent = "0 / 0";
    byId("screen-image").hidden = true;
    byId("original-link").hidden = true;
    byId("screen-title").textContent = "Review images are being prepared";
    return;
  }
  selected = Math.max(0, Math.min(screens.length - 1, index));
  const screen = screens[selected];
  const slug = slugOf(screen);
  select.value = slug;
  const img = byId("screen-image");
  img.src = screen.file;
  img.alt = screen.title + ". " + screen.intent;
  img.width = screen.width;
  img.height = screen.height;
  byId("original-link").href = screen.file;
  const mobileHeight = screen.effectiveHeightAt360 ?? Math.round(screen.height / screen.width * 360 * 10) / 10;
  byId("screen-caption").textContent = screen.width + " × " + screen.height + " px · " + mobileHeight + " px high at 360 px width.";
  byId("screen-id").textContent = screen.id + " · " + (screen.status || "PENDING OWNER REVIEW");
  byId("screen-title").textContent = screen.title;
  byId("intent").textContent = screen.intent;
  byId("position").textContent = (selected + 1) + " / " + screens.length;
  byId("previous").disabled = selected === 0;
  byId("next").disabled = selected === screens.length - 1;
  renderList("review-list", screen.review);
  renderList("discrepancy-list", screen.discrepancies);
  applyScale();
  if (updateHash && location.hash !== "#" + slug) history.replaceState(null, "", "#" + slug);
}
function fromHash() {
  let slug;
  try { slug = decodeURIComponent(location.hash.slice(1)); }
  catch { slug = ""; }
  const index = screens.findIndex(screen => slugOf(screen) === slug);
  render(index < 0 ? 0 : index, false);
}
select.addEventListener("change", () => render(screens.findIndex(screen => slugOf(screen) === select.value)));
byId("scale-select").addEventListener("change", applyScale);
byId("previous").addEventListener("click", () => render(selected - 1));
byId("next").addEventListener("click", () => render(selected + 1));
window.addEventListener("hashchange", fromHash);
window.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.isContentEditable || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(event.target.tagName)) return;
  if (event.key === "ArrowLeft") render(selected - 1);
  if (event.key === "ArrowRight") render(selected + 1);
});
fromHash();
