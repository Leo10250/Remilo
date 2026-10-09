const screens = [
  {
    "id": "R8-01",
    "file": "01-settings-overview-sunrise-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "df50ad8618853974bf4c72ee78782f2320e49a43927b9f7b808110c8adb21710",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sunrise",
    "appearance": "Light",
    "referenceId": "R3-01",
    "title": "Settings overview · Sunrise / Light",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Settings overview using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Permissions may enter the lower viewport; remaining categories scroll.",
      "No page Save, root bar or FAB."
    ],
    "discrepancies": [
      "The first candidate copied the taller Agenda opening; a targeted repair shortened it close to the 96dp secondary-opening target. Implementation must use the actual shared 56dp toolbar/40dp crop rather than PNG geometry.",
      "The newly visible Tomorrow morning row reaches the bottom gesture area. Treat it as a partially scrolled row, not approved safe-area placement; actual content needs enough bottom padding to reveal the full row clear of system insets.",
      "Test alarm uses a Play glyph and On-time alarms a bell rather than the specified shared alarm/schedule glyphs. Use the existing neutral structural icon family consistently; preview and Test remain separate actions."
    ]
  },
  {
    "id": "R8-02",
    "file": "02-preference-save-unconfirmed-sunrise-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "640d44533023fc9edcfedcc4b5a4fb691ab4a808299a51b5f85039fd62eb6d72",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sunrise",
    "appearance": "Dark",
    "referenceId": "R3-02",
    "title": "Preference save unconfirmed · Sunrise / Dark",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Preference save unconfirmed using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Retry retains the captured preference job; a stale revision follows existing rebase rules.",
      "Do not claim native write failed or pending patch was discarded."
    ],
    "discrepancies": [
      "Targeted repair neutralized inconsistent colored settings glyphs and made the Dark ON switch pale apricot. Keep these shared neutral/action roles in implementation rather than R3 category hues.",
      "Retry was repaired from a filled gradient to an outlined action, but its visible height remains smaller than the 56dp target. Use a measured shared secondary action and allow lower Permissions to scroll.",
      "The error panel uses a warm warning illustration; a save-confirmation failure must use the actual shared semantic error treatment with the same explicit text. Its placement after the Alarms card is approximate; keep feedback proximate to the affected preference.",
      "Header crop is slightly taller than the compact master and icon anatomy varies. Reuse the common crop, alarm/schedule glyphs and 16dp component geometry."
    ]
  },
  {
    "id": "R8-03",
    "file": "03-appearance-fixed-sky-light-sky-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "203630988c61edb6c42a440e73a51dc52a15746aa3b42ae5813786bb6a3d26f8",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sky",
    "appearance": "Light",
    "referenceId": "R3-03",
    "title": "Appearance fixed Sky Light · Sky / Light",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Appearance fixed Sky Light using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Four scene tiles are previews; surrounding page remains Sky Light.",
      "Light and Sky each have explicit radio/check semantics; no Automatic control."
    ],
    "discrepancies": [
      "The scenic crop is somewhat taller than the 96dp secondary-opening target. Use the shared toolbar/crop metrics rather than requiring this raster height.",
      "Four named tiles and explicit Light/Sky selection are correct. Exact tile/radio geometry is approximate; at larger text use growing labels or one column, without shrinking targets.",
      "Light/Dark explanatory helper lines were added for clarity but wording should come from shared product copy. There is no new save/Automatic/default policy."
    ]
  },
  {
    "id": "R8-04",
    "file": "04-appearance-system-saving-sky-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "4298ae2eabe5a553cfd51347e2950d00a316c57dca2e40b1ee8d7fa3013c8f57",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sky",
    "appearance": "Dark",
    "referenceId": "R3-04",
    "title": "Appearance System saving · Sky / Dark",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Appearance System saving using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "System selected and device Dark yields Sky Dark; preserve daytime scene.",
      "Saving is brightness preference progress, not proof of four-atmosphere persistence."
    ],
    "discrepancies": [
      "The initial Dark variant retained a bright Light sky behind white title and a black Back arrow; a targeted repair restored the darker Sky upper sky and consistent white toolbar content. Use the shared contrast-protected toolbar roles on actual components.",
      "Header height and selected-tile outline thickness differ slightly from Light. Share anatomy/crop/selection components; atmosphere/brightness change role values, not geometry.",
      "Saving is an oversized static progress panel with a visible spinner segment and blue-looking support. Use common accessible progress/neutral helper roles and expose acknowledgement plus refreshed revision before success. Static artwork does not prove animation or persistence.",
      "The preview tiles vary in Dark tonal detail from the exact R3 assets. Reuse the selected bundled scene/crop rather than adopt each independently generated mini-scene."
    ]
  },
  {
    "id": "R8-05",
    "file": "05-sound-preview-fallback-evening-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "a6a21c0646fc4d51c5d68d2597ae2c1fa85d4f0f6fc9d10498cd0a0e4c946b9e",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Evening",
    "appearance": "Light",
    "referenceId": "R3-05",
    "title": "Sound preview fallback · Evening / Light",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Sound preview fallback using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "System request has Stop; Remilo remains the selected radio.",
      "Play does not save/select or create a test."
    ],
    "discrepancies": [
      "Background Vibration appears as ON disclosure instead of boolean switch; implementation must use existing switch. Sound sheet foreground state is correct.",
      "Background Alarms uses separate rounded rows and clock/flask glyphs, whereas shared Settings uses grouped card and established Snooze/Test glyphs; reuse shared components.",
      "Static sound glyphs are neutral and selected Remilo stays independent of System-request Stop/fallback. No exact color/metric or accessible-target verification claimed."
    ]
  },
  {
    "id": "R8-06",
    "file": "06-sound-preview-failure-evening-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "ea38038529662a24c5d81763d30853049c9767e3f4a3dbc5bdeaa31127ba4475",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Evening",
    "appearance": "Dark",
    "referenceId": "R3-06",
    "title": "Sound preview failure · Evening / Dark",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Sound preview failure using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "System remains selected despite failure.",
      "No invented volume reading; actions are preview Play, not retry preference saving."
    ],
    "discrepancies": [
      "Background Alarms is individual rounded rows rather than one grouped Settings card; reuse canonical grouped structure. Static Snooze/Test glyphs should match shared component family.",
      "Error text is bright coral and ordinary helper text has a slight purple cast; use shared semantic error and neutral support roles, not raster samples.",
      "Foreground controls preserve System selection, both Play actions, failed native preview, and bounded-priority helper. Dimmed background Sound matches System alarm."
    ]
  },
  {
    "id": "R8-07",
    "file": "07-permissions-with-mixed-channels-night-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "ae99be3e0503778e392cb2e777faac6e020486d68b94a3b8cfd1f0a025531562",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Night",
    "appearance": "Light",
    "referenceId": "R3-07",
    "title": "Permissions with mixed channels · Night / Light",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Permissions with mixed channels using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Rows hand off to Android; no Enable toggle or custom permission screen.",
      "Mixed channels do not block Alarm scheduling; full-screen Limited is presentation only."
    ],
    "discrepancies": [
      "Secondary scenic opening remains about160dp total instead of120dp; implement96dp below status including56dp toolbar, crop art first.",
      "Allowed/Blocked/Limited are neutral explicit text; apply shared semantic status styles if used rather than arbitrary atmospheric tint. Ordinary icons/support remain neutral.",
      "Generated optional shortcuts show complete correct10AM/2PM/5PM values; these are local-time preferences, not atmosphere boundaries. Notifications Blocked is driven only by Reminder channel; Alarm channel/App access Allowed and Lock-screen Limited remain separate."
    ]
  },
  {
    "id": "R8-08",
    "file": "08-permissions-refresh-failure-night-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "dba4c154ec489cdf2900a1482b5951a39f96e10d9ac591714fcee05fcceb174a",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Night",
    "appearance": "Dark",
    "referenceId": "R3-08",
    "title": "Permissions refresh failure · Night / Dark",
    "status": "Supplementary reference under approved R8 direction · completed after A30",
    "intent": "Permissions refresh failure using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Retain last snapshot with explicit staleness; no freshly checked success.",
      "Initial Checking and initial failure are additional component states, not this snapshot.",
      "This state was completed after the owner approved the R8 direction; no separate pixel review is claimed."
    ],
    "discrepancies": [
      "The initial candidate included the whole Alarms section despite this being a Permissions scroll capture; a targeted repair moved Alarms above the viewport and kept the stale snapshot, failure and Retry readable.",
      "Retry remains visually shorter than the 56dp target, with bluish ordinary support text. Bind support to shared neutral roles and use a measured accessible secondary action with normal scrolling.",
      "Could not refresh is shown with a neutral circled exclamation rather than the shared semantic failure role. Keep the explicit last-checked time and error text; actual components should use the documented failure treatment without recoloring ordinary permission icons.",
      "Header/canvas/elevated tones and glyph anatomy are approximate. Reuse the R3 Night Dark roles and common crop/schedule glyph; last snapshot Allowed is not a fresh permission observation."
    ]
  },
  {
    "id": "R8-09",
    "file": "09-test-scheduled-sunrise-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "216941536c239391284eb5d84c1dbfe9dc67e79ac29bf98c07792668f029de9f",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sunrise",
    "appearance": "Light",
    "referenceId": "R3-01",
    "title": "Test scheduled · Sunrise / Light",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Test scheduled using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Time/occurrence identity come from native result; View is proposed contextual navigation.",
      "Do not imply test auto-deletes, Stop completes, or device acceptance passed."
    ],
    "discrepancies": [
      "Scheduled feedback contains the correct 15-second native target and a separate View action. The helper asks the user to listen; it does not report heard audio or a physical test pass.",
      "The Scheduled clock badge borrows orange primary styling. Use the shared labeled scheduling-state role or neutral structural glyph independently of the View action accent.",
      "Opening, heading weight and row metrics are approximate. Enforce the shared compact opening, scalable type and actual minimum target/safe-area measurements."
    ]
  },
  {
    "id": "R8-10",
    "file": "10-test-saved-but-blocked-sky-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "25253de8aa77eeb024f96ba2c52dbbc83dcf47c0952e2f91d3b73e88729d9591",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Sky",
    "appearance": "Dark",
    "referenceId": "R3-04",
    "title": "Test saved but blocked · Sky / Dark",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Test saved but blocked using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Use existing On-time alarms row for Android handoff; no silent Notification downgrade.",
      "This particular fixture has a known permission cause; other Blocked results may be registration failure."
    ],
    "discrepancies": [
      "The Blocked result is distinct from the Test action and gives the observed exact-access cause. Keep View separate from creating another test; returning from permissions must refresh actual native status.",
      "The On-time alarms glyph remains a bell rather than the shared schedule glyph. Standardize neutral structural icons across Settings, including Test.",
      "Warning-panel tint, blue-looking metadata and switch-thumb shade are generated approximations. Use shared semantic Blocked, neutral support and paired Sky Dark selection roles; do not sample separate page colors.",
      "The compact opening and bottom card clearance need actual component measurements and system insets. A Blocked result is saved content, not a rejected or silently downgraded Alarm."
    ]
  },
  {
    "id": "R8-11",
    "file": "11-invalid-custom-snooze-with-keyboard-evening-light.png",
    "width": 841,
    "height": 1870,
    "sha256": "6f01161e1bc5151ad13776098aa59564046f9b6a4080214667f5353d29ad533c",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Evening",
    "appearance": "Light",
    "referenceId": "R3-05",
    "title": "Invalid custom Snooze with keyboard · Evening / Light",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Invalid custom Snooze with keyboard using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "One disabled 56dp action above real IME, error and caret visible; Close/Cancel preserves 10.",
      "Use custom duration is picker submission, not Settings-wide Save."
    ],
    "discrepancies": [
      "The invalid 0, caret, inline error, selected 10-minute saved value and single disabled action above the IME are correct. Closing preserves the saved duration; this local invalid draft does not save settings.",
      "Radio rows and the disabled action remain visually shorter than the specified 48/56 dp targets. Use actual minimum sizes and let presets scroll instead of shrinking text to fit.",
      "The keyboard is an illustrative Android numeric IME. Use the real system keyboard, one inset owner and measured footer/caret/error clearance; its key shapes or accent are not Remilo components.",
      "The red validation text and plum field outline require shared error/focus tokens with measured contrast. The disabled action needs readable disabled content and no mutation."
    ]
  },
  {
    "id": "R8-12",
    "file": "12-edit-tomorrow-shortcut-time-night-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "73f6899e598313fffceaea1a68250f0ddf2b9382145edd662a85008f97a5e84d",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Night",
    "appearance": "Dark",
    "referenceId": "R3-08",
    "title": "Edit tomorrow shortcut time · Night / Dark",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Edit tomorrow shortcut time using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Underlying saved afternoon stays 2PM until picker OK; Cancel does not mutate.",
      "OS-owned picker styling may differ from app; shortcuts are not atmosphere time bands."
    ],
    "discrepancies": [
      "The time picker shows a 3 PM draft while the underlying saved afternoon shortcut remains 2 PM. Cancel preserves 2 PM; OK submits the valid preference through the existing controller.",
      "The scenic opening is about 145 dp including status rather than the 120 dp total target. Crop the artwork to the shared compact opening before reducing useful content.",
      "Shortcut glyphs depict sun-related scenes rather than the shared clock icon, and ordinary support/glyphs have a lavender tint. Use neutral structural clock roles consistently; these times are not atmosphere switching bands.",
      "The OS-owned time picker is an illustrative device-Dark dialog. Its independent platform accent is permissible. Use the actual locale-aware native picker and proper dialog scrim rather than build a scenic Remilo picker.",
      "The lower Data/Help background is illustrative continuation of existing categories, not approval of a new backup/help workflow. Show factual build/version information without treating Version as a new disclosure destination."
    ]
  },
  {
    "id": "R8-13",
    "file": "13-test-saved-with-pending-scheduling-evening-dark.png",
    "width": 841,
    "height": 1870,
    "sha256": "aa5cb04a82aa408ae5295ac8ad991d2b67a8a6f2add53bfc7c084f8be8cc9a68",
    "effectiveHeightAt360": 800.5,
    "atmosphere": "Evening",
    "appearance": "Dark",
    "referenceId": "R3-06",
    "title": "Test saved with pending scheduling · Evening / Dark",
    "status": "Associated reference · R8 direction/templates approved (A30); pixels approximate",
    "intent": "Test saved with pending scheduling using the corresponding R3 atmosphere and established R8 workflow.",
    "review": [
      "Native result acknowledges content; Pending registration is not lost acknowledgement.",
      "No Scheduled success chip, Retry test, invented Cancel test or physical-pass claim."
    ],
    "discrepancies": [
      "Pending is correctly an acknowledged saved reminder with uncertain registration, with View and no Retry test. Its warning icon/container borrow rose primary styling; implement the shared semantic Pending/warning role independently of the Evening action accent.",
      "Ordinary supporting values and chevrons have a lavender-looking tint. Resolve them through neutral onSurfaceVariant/structural roles; reserve intentional pale rose for selected switch and View action.",
      "Test and On-time glyphs follow the generated master Play/bell rather than the established alarm/schedule glyph family. Use shared neutral structural icons and preserve the preview-versus-test distinction.",
      "The reading-card shade/elevation and header crop are qualitative reference approximations. Reuse corresponding shared Evening Dark canvas and elevated surfaces rather than sampling a page-specific black or exact generated hue."
    ]
  }
];
// Root assembles gallery.js as: const screens = <final metadata JSON>; followed by this runtime.
// This file intentionally contains no fetch or generated image data.
const expectedScreenIds = Array.from({length:13}, (_, index) => "R8-" + String(index + 1).padStart(2,"0"));
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
    byId("position").textContent = "0 / 13";
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
  img.hidden = false;
  img.src = screen.file;
  img.alt = screen.title + ". " + screen.intent;
  img.width = screen.width;
  img.height = screen.height;
  byId("original-link").hidden = false;
  byId("original-link").href = screen.file;
  const mobileHeight = screen.effectiveHeightAt360 ?? Math.round(screen.height / screen.width * 360 * 10) / 10;
  byId("screen-caption").textContent = screen.width + " × " + screen.height + " px · " + mobileHeight + " px high at 360 px width.";
  byId("screen-id").textContent = screen.id + " · " + (screen.status || "Proposed · pending owner review");
  byId("screen-title").textContent = screen.title;
  byId("intent").textContent = screen.intent;
  byId("position").textContent = (selected + 1) + " / " + screens.length;
  byId("previous").disabled = selected === 0;
  byId("next").disabled = selected === screens.length - 1;
  renderList("review-list", screen.review);
  renderList("discrepancy-list", screen.discrepancies);
  applyScale();
  if (updateHash && location.hash !== "#" + slug) history.replaceState(null,"","#" + slug);
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
