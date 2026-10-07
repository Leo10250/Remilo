/** Measures actual composited pixels in the saved synthetic P01 render pairs. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const sharp = createRequire(import.meta.url)(process.argv[2] || 'sharp');
const root = resolve(import.meta.dirname, '..');
const evidence = join(root, 'docs/evidence/redesign-p01/render-r1');
const luminance = (rgb) => rgb.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const results = [];
const controls = [];
async function inspect(directory, entry, native) {
  if (!entry.background) return;
  const original = await sharp(await readFile(join(directory, entry.file))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const background = await sharp(await readFile(join(directory, entry.background))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // The IAB screenshot backend normalizes the bitmap a second time at the host
  // display density. The complete CSS frame is painted at 1 / density, with
  // unused bitmap padding. Keep originals intact and map measured CSS bounds.
  const pixelScale = native ? 1 : 1 / entry.density;
  assert.equal(original.info.width, entry.width, 'The capture tool emits CSS-normalized image width.');
  assert.equal(original.info.height, entry.height, 'The capture tool emits CSS-normalized image height.');
  assert.deepEqual(original.info, background.info);
  for (const [kind, elements] of [['text', entry.textBounds], ['indicator', entry.indicators || []]]) for (const element of elements) {
    if (!element.ink || element.width <= 0 || element.height <= 0) continue;
    const ink = native ? [(element.ink >>> 16) & 255, (element.ink >>> 8) & 255, element.ink & 255] : element.ink.match(/[\d.]+/g).slice(0, 3).map(Number);
    const clip = element.clip || { left: 0, top: 0, width: entry.width, height: entry.height };
    // A pixel's centre must lie inside the ancestor clip. Otherwise a partially
    // visible final line can be mistaken for the scenery just below the scroll.
    const x0 = Math.max(0, Math.ceil(Math.max(element.left, clip.left) * pixelScale - .5)), y0 = Math.max(0, Math.ceil(Math.max(element.top, clip.top) * pixelScale - .5));
    const x1 = Math.min(original.info.width, Math.ceil(Math.min(element.left + element.width, clip.left + clip.width) * pixelScale - .5)), y1 = Math.min(original.info.height, Math.ceil(Math.min(element.top + element.height, clip.top + clip.height) * pixelScale - .5));
    const fontSize = native ? element.fontSizeSp * entry.fontScale : element.fontSize;
    const threshold = kind === 'indicator' || fontSize >= 24 || fontSize >= 18.667 && Number(element.weight || 400) >= 700 ? 3 : 4.5;
    let minimum = Infinity, samples = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * original.info.width + x) * 3;
      // Text-free paired render supplies the artwork/surface pixels beneath glyphs.
      // Ignore minor JPEG/antialias changes; use the authored full ink for contrast.
      if (Math.max(...[0, 1, 2].map(c => Math.abs(original.data[i + c] - background.data[i + c]))) < 25) continue;
      minimum = Math.min(minimum, ratio(luminance(ink), luminance([background.data[i], background.data[i + 1], background.data[i + 2]])));
      samples++;
    }
    if (samples) results.push({ file: entry.file, kind, text: element.text, minimum, threshold, samples, passed: minimum >= threshold });
  }
  if (native) for (const label of ['Stop', 'Snooze · 10 min']) {
    const text = entry.textBounds.find(element => element.text === label);
    if (!text) continue;
    const y = Math.round(text.top + text.height / 2);
    if (y < 0 || y >= entry.height) continue;
    const rgb = x => [...background.data.subarray((y * entry.width + x) * 3, (y * entry.width + x) * 3 + 3)];
    const outside = luminance(rgb(0));
    // At the horizontal centreline the rounded outline has its full thickness.
    // Restrict sampling to the left of the label, excluding every glyph.
    const boundary = Math.max(...Array.from({ length: Math.max(1, Math.floor(text.left) - 8) }, (_, x) => ratio(luminance(rgb(x)), outside)));
    controls.push({ file: entry.file, label, minimum: boundary, threshold: 3, passed: boundary >= 3 });
  }
}
const rnDirectory = join(evidence, 'rn');
const rn = JSON.parse(await readFile(join(rnDirectory, 'index.json')));
rn.snapshots = [...new Map(rn.snapshots.map(entry => [entry.file, entry])).values()];
await writeFile(join(rnDirectory, 'index.json'), JSON.stringify(rn, null, 2) + '\n');
for (const entry of rn.snapshots) {
  assert.ok(entry.textBounds.every(element => !element.clipped), entry.file + ': unclipped RN text');
  assert.ok(entry.actions.every(action => action.width >= 47.9 && action.height >= 47.9), entry.file + ': minimum action targets');
  await inspect(rnDirectory, entry, false);
  if (entry.variant === 'corrected' && entry.scrollPosition === 'controls') {
    const last = entry.actions.find(action => action.label === 'More actions for Grocery shopping');
    const add = entry.actions.find(action => action.label === 'Add reminder');
    assert.ok(last && add && last.top >= entry.scroll.top && last.top + last.height <= entry.scroll.top + entry.scroll.height + 1,
      entry.file + ': last reminder action is reachable');
    assert.ok(last.top + last.height <= add.top, entry.file + ': Add never overlaps the scrolled reminder action');
  }
  if (entry.variant === 'corrected') assert.equal(entry.actions.find(action => action.label === 'Agenda').selected, 'true');
}
const semanticPairs = [];
for (const corrected of rn.snapshots.filter(entry => entry.variant === 'corrected' && !entry.extra && entry.scrollPosition === 'top')) {
  const current = rn.snapshots.find(entry => entry.variant === 'current' && entry.width === corrected.width && entry.height === corrected.height &&
    entry.scenario === corrected.scenario && entry.dark === corrected.dark && entry.fontScale === corrected.fontScale);
  assert.ok(current, corrected.file + ': current comparison exists');
  const reminderLabels = entry => entry.actions.map(action => action.label).filter(label => /^(Done:|Open |More actions for)/.test(label)).sort();
  assert.deepEqual(reminderLabels(corrected), reminderLabels(current), corrected.file + ': occurrence/timing/work/delivery semantics unchanged');
  semanticPairs.push({ current: current.file, corrected: corrected.file, matchedReminderActions: reminderLabels(corrected).length });
}
for (const directory of await readdir(join(evidence, 'native'))) {
  if (!directory.startsWith('compose-')) continue;
  const absolute = join(evidence, 'native', directory);
  for (const entry of JSON.parse(await readFile(join(absolute, 'index.json'))).snapshots) await inspect(absolute, entry, true);
}
const failures = results.filter(row => !row.passed);
await writeFile(join(evidence, 'contrast.json'), JSON.stringify({ method: 'Actual paired background pixels under glyph differences ≥25 RGB levels; full intended foreground ink. Native PNG and RN JPEG host captures. RN CSS bounds map at inverse host display density. Offscreen elements omitted; pixel centres respect ancestor clips. Thresholds are conservative where font weight is unavailable.', deviceEvidence: false, elements: results.length, minimumText: Math.min(...results.filter(r => r.kind === 'text').map(r => r.minimum)), minimumIndicator: Math.min(...results.filter(r => r.kind === 'indicator').map(r => r.minimum)), failures, results }, null, 2) + '\n');
await writeFile(join(evidence, 'semantics-and-controls.json'), JSON.stringify({ semanticPairs, rnMinimumTargetDp: Math.min(...rn.snapshots.flatMap(entry => entry.actions.flatMap(action => [action.width, action.height]))), nativeControlBoundaryMethod: 'Full-thickness centreline stroke/fill compared to actual adjacent composited canvas, left of all text; includes fallback and scrolled views.', nativeControls: controls }, null, 2) + '\n');
console.log(JSON.stringify({ elements: results.length, failures: failures.slice(0, 20), totalFailures: failures.length }, null, 2));
assert.equal(failures.length, 0, 'Composite contrast must pass before render approval submission.');
assert.ok(controls.every(control => control.passed), 'Actual native control boundaries must reach 3:1.');
