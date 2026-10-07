"use strict";
const screens = [
  {
    "theme": "sunrise",
    "file": "01-sunrise-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "EF283858ACDBA743163344993997A381D4E46A2992F5158FFFDA92FD0693673C",
    "effectiveHeightAt360": 800.5,
    "id": "R6-04-Sunrise-Dark",
    "title": "Sunrise · Dark · Privacy-safe alarm",
    "status": "Approved as starting direction with color condition (A24)",
    "intent": "The same generic alarm information and native actions with the selected global Sunrise · Dark atmosphere. Softer reading surfaces follow the existing theme card roles.",
    "review": [
      "Generic Reminder text remains appropriate before first unlock; bundled scenery and colors do not identify the task.",
      "The same layout supports ordinary unlocked alarms with private content when permitted. All native states must support four atmospheres in Light and Dark.",
      "The held 10:00 AM clock does not define automatic appearance boundaries.",
      "Accepted as a design starting point; detailed coloring and overall visual polish may be refined later."
    ],
    "discrepancies": [
      "Owner condition (A24): the full-page background and elevated reading surfaces must use the corresponding existing atmosphere/appearance's shared semantic color roles. Match the approved theme instead of adopting an independent alarm-specific black or sampling a generated PNG shade. Exact detailed coloring and later visual polish remain open.",
      "Surface and button gradients are still raster approximation. Production uses the shared theme surface/primary/onPrimary tokens, with softer elevated Dark reading planes; do not sample these images as exact final hex values.",
      "Title/bell spacing, corner radii and action heights drift slightly between variants. Use one native component with 64 dp urgent actions and 12 dp gap; change assets/role values rather than geometry.",
      "The large calm middle region is flexible space, not a fixed spacer. Reduce artwork and scroll information appropriately for larger text/smaller height.",
      "Before first unlock retain generic content and no private category/Event/Due/notes/list data."
    ]
  },
  {
    "theme": "sky",
    "file": "02-sky-dark.png",
    "width": 841,
    "height": 1871,
    "sha256": "A33061C1CA6C6187AE3A0E09115B479DC297874CA4D99B6479FB3A2E540052BC",
    "effectiveHeightAt360": 800.9,
    "id": "R6-04-Sky-Dark",
    "title": "Sky · Dark · Privacy-safe alarm",
    "status": "Approved as starting direction with color condition (A24)",
    "intent": "The same generic alarm information and native actions with the selected global Sky · Dark atmosphere. Softer reading surfaces follow the existing theme card roles.",
    "review": [
      "Generic Reminder text remains appropriate before first unlock; bundled scenery and colors do not identify the task.",
      "The same layout supports ordinary unlocked alarms with private content when permitted. All native states must support four atmospheres in Light and Dark.",
      "The held 10:00 AM clock does not define automatic appearance boundaries.",
      "Accepted as a design starting point; detailed coloring and overall visual polish may be refined later."
    ],
    "discrepancies": [
      "Owner condition (A24): the full-page background and elevated reading surfaces must use the corresponding existing atmosphere/appearance's shared semantic color roles. Match the approved theme instead of adopting an independent alarm-specific black or sampling a generated PNG shade. Exact detailed coloring and later visual polish remain open.",
      "Surface and button gradients are still raster approximation. Production uses the shared theme surface/primary/onPrimary tokens, with softer elevated Dark reading planes; do not sample these images as exact final hex values.",
      "Title/bell spacing, corner radii and action heights drift slightly between variants. Use one native component with 64 dp urgent actions and 12 dp gap; change assets/role values rather than geometry.",
      "The large calm middle region is flexible space, not a fixed spacer. Reduce artwork and scroll information appropriately for larger text/smaller height.",
      "Before first unlock retain generic content and no private category/Event/Due/notes/list data."
    ]
  },
  {
    "theme": "evening",
    "file": "03-evening-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "AFF2E9F80E6E008DA5A11A750F3609FAE5079786954458A2E4B820D628B7F6C8",
    "effectiveHeightAt360": 800.5,
    "id": "R6-04-Evening-Dark",
    "title": "Evening · Dark · Privacy-safe alarm",
    "status": "Approved as starting direction with color condition (A24)",
    "intent": "The same generic alarm information and native actions with the selected global Evening · Dark atmosphere. Softer reading surfaces follow the existing theme card roles.",
    "review": [
      "Generic Reminder text remains appropriate before first unlock; bundled scenery and colors do not identify the task.",
      "The same layout supports ordinary unlocked alarms with private content when permitted. All native states must support four atmospheres in Light and Dark.",
      "The held 10:00 AM clock does not define automatic appearance boundaries.",
      "Accepted as a design starting point; detailed coloring and overall visual polish may be refined later."
    ],
    "discrepancies": [
      "Owner condition (A24): the full-page background and elevated reading surfaces must use the corresponding existing atmosphere/appearance's shared semantic color roles. Match the approved theme instead of adopting an independent alarm-specific black or sampling a generated PNG shade. Exact detailed coloring and later visual polish remain open.",
      "Surface and button gradients are still raster approximation. Production uses the shared theme surface/primary/onPrimary tokens, with softer elevated Dark reading planes; do not sample these images as exact final hex values.",
      "Title/bell spacing, corner radii and action heights drift slightly between variants. Use one native component with 64 dp urgent actions and 12 dp gap; change assets/role values rather than geometry.",
      "The large calm middle region is flexible space, not a fixed spacer. Reduce artwork and scroll information appropriately for larger text/smaller height.",
      "No private category/Event/Due/notes/list data is allowed before first unlock. The stray generated plant badge was removed and must stay absent."
    ]
  },
  {
    "theme": "night",
    "file": "04-night-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "5AC388158F27E4D4F7D30DC758F17C947EC988E8CDA5343D1D3E00020471EAFA",
    "effectiveHeightAt360": 800.5,
    "id": "R6-04-Night-Dark",
    "title": "Night · Dark · Privacy-safe alarm",
    "status": "Approved as starting direction with color condition (A24)",
    "intent": "The same generic alarm information and native actions with the selected global Night · Dark atmosphere. Softer reading surfaces follow the existing theme card roles.",
    "review": [
      "Generic Reminder text remains appropriate before first unlock; bundled scenery and colors do not identify the task.",
      "The same layout supports ordinary unlocked alarms with private content when permitted. All native states must support four atmospheres in Light and Dark.",
      "The held 10:00 AM clock does not define automatic appearance boundaries.",
      "Accepted as a design starting point; detailed coloring and overall visual polish may be refined later."
    ],
    "discrepancies": [
      "Owner condition (A24): the full-page background and elevated reading surfaces must use the corresponding existing atmosphere/appearance's shared semantic color roles. Match the approved theme instead of adopting an independent alarm-specific black or sampling a generated PNG shade. Exact detailed coloring and later visual polish remain open.",
      "Surface and button gradients are still raster approximation. Production uses the shared theme surface/primary/onPrimary tokens, with softer elevated Dark reading planes; do not sample these images as exact final hex values.",
      "Title/bell spacing, corner radii and action heights drift slightly between variants. Use one native component with 64 dp urgent actions and 12 dp gap; change assets/role values rather than geometry.",
      "The large calm middle region is flexible space, not a fixed spacer. Reduce artwork and scroll information appropriately for larger text/smaller height.",
      "Before first unlock retain generic content and no private category/Event/Due/notes/list data."
    ]
  }
];
const byId = id => document.getElementById(id);
let selected = 0;
const select = byId("screen-select");
for (const screen of screens) {
  const option = document.createElement("option");
  option.value = screen.file.replace(/\.png$/, "");
  option.textContent = screen.id + " · " + screen.title;
  select.appendChild(option);
}
function renderList(id, lines) {
  const list = byId(id);
  list.replaceChildren();
  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  }
}
function render(index, updateHash = true) {
  selected = Math.max(0, Math.min(screens.length - 1, index));
  const screen = screens[selected];
  const slug = screen.file.replace(/\.png$/, "");
  select.value = slug;
  const img = byId("screen-image");
  img.src = screen.file;
  img.alt = screen.title + ". " + screen.intent;
  img.width = screen.width;
  img.height = screen.height;
  byId("original-link").href = screen.file;
  byId("screen-caption").textContent = screen.width + " × " + screen.height + " px · " + screen.effectiveHeightAt360 + " px high at 360 px width.";
  byId("screen-id").textContent = screen.id + " · " + (screen.status || "CANDIDATE");
  byId("screen-title").textContent = screen.title;
  byId("intent").textContent = screen.intent;
  byId("position").textContent = (selected + 1) + " / " + screens.length;
  byId("previous").disabled = selected === 0;
  byId("next").disabled = selected === screens.length - 1;
  renderList("review-list", screen.review);
  renderList("discrepancy-list", screen.discrepancies);
  if (updateHash && location.hash !== "#" + slug) history.replaceState(null, "", "#" + slug);
}
function fromHash() {
  const slug = decodeURIComponent(location.hash.slice(1));
  const index = screens.findIndex(screen => screen.file.replace(/\.png$/, "") === slug);
  render(index < 0 ? 0 : index, false);
}
select.addEventListener("change", () => render(screens.findIndex(screen => screen.file.replace(/\.png$/, "") === select.value)));
byId("scale-select").addEventListener("change", event => {
  document.documentElement.style.setProperty("--preview-width", event.target.value + "px");
});
byId("previous").addEventListener("click", () => render(selected - 1));
byId("next").addEventListener("click", () => render(selected + 1));
window.addEventListener("hashchange", fromHash);
window.addEventListener("keydown", event => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
  if (event.key === "ArrowLeft") render(selected - 1);
  if (event.key === "ArrowRight") render(selected + 1);
});
fromHash();
