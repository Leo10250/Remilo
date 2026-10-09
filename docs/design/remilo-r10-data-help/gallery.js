"use strict";
(function () {
  const byId = (id) => document.getElementById(id);
  const parseJson = (id, fallback) => {
    try { return JSON.parse(byId(id).textContent); } catch (_) { return fallback; }
  };
  const captures = parseJson("capture-index-data", []);
  let reviewData = parseJson("review-notes-data", []);
  let selectedIndex = 0;
  let previewWidth = "360";
  let imageTicket = 0;
  const image = byId("ui-image");
  const imageStatus = byId("image-status");
  const placeholder = byId("image-placeholder");
  const listButtons = [];
  const widthButtons = Array.from(document.querySelectorAll("#width-controls button[data-width]"));
  const referenceFiles = {
    "sunrise-light": "01-sunrise-light.png",
    "sunrise-dark": "02-sunrise-dark.png",
    "sky-light": "03-sky-light.png",
    "sky-dark": "04-sky-dark.png",
    "evening-light": "05-evening-light.png",
    "evening-dark": "06-evening-dark.png",
    "night-light": "07-night-light.png",
    "night-dark": "08-night-dark.png"
  };
  const referenceRoles = {
    "sunrise-light": "Warm off-white canvas, white raised surfaces and burnt-orange actions; sunrise lake and conifers.",
    "sunrise-dark": "Soft charcoal canvas and raised charcoal surfaces with pale-apricot actions; the same sunrise scene.",
    "sky-light": "Pale cool-blue canvas, white raised surfaces and saturated-blue actions; daytime clouds and lake.",
    "sky-dark": "Blue-slate canvas and raised slate surfaces with pale-sky-blue actions; daytime clouds remain visible.",
    "evening-light": "Pale rose canvas, white raised surfaces and muted-plum actions; sunset sun and reflection.",
    "evening-dark": "Plum-charcoal canvas and raised plum surfaces with pale-rose actions; the same sunset scene.",
    "night-light": "Icy-blue canvas, white raised surfaces and deep-blue actions; crescent moon and stars.",
    "night-dark": "Navy-slate canvas and raised navy surfaces with pale-periwinkle actions; the same moonlit scene."
  };

  function asList(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }
  function noteText(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const title = value.title || value.label || "";
    const detail = value.text || value.description || value.correction || value.body || value.note || "";
    return title && detail ? title + ": " + detail : String(detail || title);
  }
  function noteFor(id) {
    if (Array.isArray(reviewData)) return reviewData.find((entry) => entry.id === id || entry.captureId === id) || {};
    if (!reviewData || typeof reviewData !== "object") return {};
    const collection = reviewData.screens || reviewData.captures || reviewData.entries || reviewData.reviewNotes;
    if (Array.isArray(collection)) return collection.find((entry) => entry.id === id || entry.captureId === id) || {};
    return (collection && collection[id]) || (reviewData.byScreen && reviewData.byScreen[id]) || reviewData[id] || {};
  }
  function fillList(element, values) {
    element.replaceChildren();
    const texts = asList(values).map(noteText).filter(Boolean);
    for (const text of texts) {
      const item = document.createElement("li");
      item.textContent = text;
      element.appendChild(item);
    }
    return texts.length;
  }
  function renderNotes(capture) {
    const entry = noteFor(capture.id);
    fillList(byId("review-expectations"), capture.notes || []);
    const observations = entry.observations || entry.discrepancies || entry.visualDiscrepancies || entry.generationObservations || entry.notes || [];
    const corrections = entry.corrections || entry.implementationCorrections || entry.resolutions || entry.implementationNotes || [];
    const observed = fillList(byId("generation-observations"), observations);
    const corrected = fillList(byId("implementation-corrections"), corrections);
    byId("observations-placeholder").hidden = observed > 0;
    byId("corrections-placeholder").hidden = corrected > 0;
  }
  function applyWidth(value) {
    previewWidth = ["360", "420", "540", "original"].includes(String(value)) ? String(value) : "360";
    const pixels = previewWidth === "original" ? (image.naturalWidth || 841) : Number(previewWidth);
    image.style.width = pixels + "px";
    image.style.height = "auto";
    document.documentElement.dataset.previewWidth = previewWidth;
    for (const button of widthButtons) button.setAttribute("aria-pressed", String(button.dataset.width === previewWidth));
  }
  function renderCapture(index, writeHash) {
    if (!captures.length) return;
    selectedIndex = Math.max(0, Math.min(captures.length - 1, index));
    const capture = captures[selectedIndex];
    document.title = "Remilo " + capture.id + " — " + capture.title;
    byId("screen-id").textContent = capture.id;
    byId("screen-title").textContent = capture.title;
    byId("screen-theme").textContent = capture.atmosphere + " · " + capture.appearance;
    byId("screen-state").textContent = capture.state.replace(/-/g, " ");
    byId("screen-surface").textContent = capture.surface;
    byId("screen-count").textContent = (selectedIndex + 1) + " / " + captures.length;
    byId("capture-select").value = capture.id;
    byId("prev-screen").disabled = selectedIndex === 0;
    byId("next-screen").disabled = selectedIndex === captures.length - 1;
    for (const button of listButtons) button.setAttribute("aria-current", String(button.dataset.captureId === capture.id));
    byId("current-reference").href = "references/" + referenceFiles[capture.referenceId];
    byId("reference-description").textContent = referenceRoles[capture.referenceId] || "Use the matching R3 reference and shared surface roles.";
    byId("open-image").href = capture.file;
    image.alt = capture.id + ": " + capture.title + ", " + capture.atmosphere + " " + capture.appearance + " synthetic UI reference.";
    image.hidden = true;
    placeholder.hidden = false;
    imageStatus.textContent = "Awaiting generation.";
    const ticket = ++imageTicket;
    image.onload = function () {
      if (ticket !== imageTicket) return;
      image.hidden = false;
      placeholder.hidden = true;
      imageStatus.textContent = "Approved design reference · implementation corrections apply.";
      applyWidth(previewWidth);
    };
    image.onerror = function () {
      if (ticket !== imageTicket) return;
      image.hidden = true;
      placeholder.hidden = false;
      imageStatus.textContent = "PNG is not yet available. Select this screen again after generation finishes.";
    };
    image.src = capture.file + (capture.assetVersion ? "?v=" + capture.assetVersion : "");
    applyWidth(previewWidth);
    renderNotes(capture);
    if (writeHash && window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + capture.id);
  }
  function selectCapture(id, writeHash = true) {
    const index = captures.findIndex((capture) => capture.id === id);
    renderCapture(index < 0 ? 0 : index, writeHash);
  }
  function closeMobileMenu() {
    if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) {
      byId("capture-sidebar").classList.remove("is-open");
      byId("menu-toggle").setAttribute("aria-expanded", "false");
    }
  }

  for (const capture of captures) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "capture-button";
    button.dataset.captureId = capture.id;
    const id = document.createElement("span");
    id.className = "capture-id";
    id.textContent = capture.id;
    const name = document.createElement("span");
    name.className = "capture-name";
    name.textContent = capture.title;
    const theme = document.createElement("span");
    theme.className = "capture-theme";
    theme.textContent = capture.atmosphere + " · " + capture.appearance;
    button.append(id, name, theme);
    button.addEventListener("click", () => { selectCapture(capture.id); closeMobileMenu(); });
    byId("capture-list").appendChild(button);
    listButtons.push(button);
    const option = document.createElement("option");
    option.value = capture.id;
    option.textContent = capture.id + " · " + capture.title;
    byId("capture-select").appendChild(option);
  }
  byId("capture-select").addEventListener("change", (event) => selectCapture(event.target.value));
  byId("prev-screen").addEventListener("click", () => renderCapture(selectedIndex - 1, true));
  byId("next-screen").addEventListener("click", () => renderCapture(selectedIndex + 1, true));
  byId("menu-toggle").addEventListener("click", () => {
    const button = byId("menu-toggle");
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    byId("capture-sidebar").classList.toggle("is-open", open);
  });
  for (const button of widthButtons) button.addEventListener("click", () => applyWidth(button.dataset.width));
  window.addEventListener("hashchange", () => {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { id = ""; }
    selectCapture(id, true);
  });
  document.addEventListener("keydown", (event) => {
    const tag = event.target && event.target.tagName;
    if (event.altKey || event.ctrlKey || event.metaKey || ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || (event.target && event.target.isContentEditable)) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); renderCapture(selectedIndex - 1, true); }
    if (event.key === "ArrowRight") { event.preventDefault(); renderCapture(selectedIndex + 1, true); }
  });
  window.RemiloGallery = {
    selectCapture,
    setWidth: applyWidth,
    setReviewNotes(data) { reviewData = data; if (captures[selectedIndex]) renderNotes(captures[selectedIndex]); },
    getState() { return { captureId: captures[selectedIndex] && captures[selectedIndex].id, width: previewWidth, count: captures.length }; }
  };
  let initialId;
  try { initialId = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { initialId = ""; }
  selectCapture(initialId, true);
  // Embedded JSON keeps file:// use portable. A served copy can refresh notes from the same source file.
  if (typeof window.fetch === "function" && window.location.protocol !== "file:") {
    window.fetch("review-notes.json", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("Review notes unavailable"); return response.json(); })
      .then((data) => window.RemiloGallery.setReviewNotes(data))
      .catch(() => {});
  }
})();
