// Export the owned R geometry to Android raster/vector variants. No Prebuild.
// Usage: node scripts/brand.mjs [path-to-sharp-package]
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/brand.mjs [path-to-sharp-package]\nExports the owned R mark and an ignored mask/size review sheet. No Prebuild or installation.');
  process.exit(0);
}
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const blue = '#245CD6';
// A substantial stem, open counter, diagonal leg, and one separated notification dot.
// All adaptive foreground geometry fits Android's central 66 dp safe circle.
const mark = 'M34 32 H55 C66 32 72 38 72 48 C72 55 67 60 60 61 L76 78 H62 L49 62 H43 V78 H34 Z M43 42 V53 H54 C60 53 62 51 62 48 C62 44 60 42 54 42 Z M74.5 31 A3.5 3.5 0 1 1 67.5 31 A3.5 3.5 0 1 1 74.5 31 Z';
const glyph = (scale = 1) => `<g transform="translate(54 54) scale(${scale}) translate(-54 -54)"><path fill="white" fill-rule="evenodd" d="${mark}"/></g>`;
const svg = (background = false, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${background ? `<rect width="108" height="108" rx="24" fill="${blue}"/>` : ''}${glyph(scale)}</svg>`;
const notificationSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="26 25 56 56">${glyph()}</svg>`;
const write = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); };
await write('assets/brand/remilo.svg', svg(true, 1.18));
await write('assets/brand/remilo-mark.svg', svg());
await write('assets/brand/remilo-notification.svg', notificationSvg);
const raster = async (path, size, background = false, scale = 1) => {
  const image = sharp(Buffer.from(svg(background, scale))).resize(size, size);
  await write(path, await (path.endsWith('.webp') ? image.webp({ lossless: true }) : image.png()).toBuffer());
};
for (const [name, size, bg, scale] of [['icon', 1024, true, 1.18], ['android-icon-foreground', 432, false, 1],
  ['android-icon-monochrome', 432, false, 1], ['splash-icon', 288, true, 1.18], ['favicon', 48, true, 1.18]]) {
  await raster(`assets/images/${name}.png`, size, bg, scale);
}
await write('assets/images/android-icon-background.png', await sharp({ create: { width: 432, height: 432, channels: 4, background: blue } }).png().toBuffer());
for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  await raster(`android/app/src/main/res/mipmap-${density}/ic_launcher.webp`, 48 * scale, true, 1.18);
  const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><defs><clipPath id="round"><circle cx="54" cy="54" r="54"/></clipPath></defs><g clip-path="url(#round)"><rect width="108" height="108" fill="${blue}"/>${glyph(1.18)}</g></svg>`;
  await write(`android/app/src/main/res/mipmap-${density}/ic_launcher_round.webp`, await sharp(Buffer.from(round)).resize(48 * scale, 48 * scale).webp({ lossless: true }).toBuffer());
  for (const name of ['ic_launcher_foreground', 'ic_launcher_monochrome']) await raster(`android/app/src/main/res/mipmap-${density}/${name}.webp`, 108 * scale);
  await write(`android/app/src/main/res/mipmap-${density}/ic_launcher_background.webp`, await sharp({ create: { width: 108 * scale, height: 108 * scale, channels: 4, background: blue } }).webp({ lossless: true }).toBuffer());
  await raster(`android/app/src/main/res/drawable-${density}/splashscreen_logo.png`, 76 * scale, true, 1.18);
}
const vector = `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="${mark}"/></vector>\n`;
await write('android/app/src/main/res/drawable/ic_remilo_foreground.xml', vector);
// The notification has a tighter optical frame for a legible 24 dp alpha silhouette.
await write('modules/remilo-alarm/android/src/main/res/drawable/ic_remilo_notification.xml',
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="56" android:viewportHeight="56"><group android:translateX="-26" android:translateY="-25"><path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="${mark}"/></group></vector>\n`);
for (const name of ['ic_launcher', 'ic_launcher_round']) await write(`android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/iconBackground"/><foreground android:drawable="@drawable/ic_remilo_foreground"/><monochrome android:drawable="@drawable/ic_remilo_foreground"/></adaptive-icon>\n`);

// Private synthetic review: real 48 px exports plus enlarged adaptive masks and 24 px notification.
const masks = {
  Circle: '<circle cx="54" cy="54" r="36"/>',
  Squircle: '<path d="M54 18 C82 18 90 26 90 54 C90 82 82 90 54 90 C26 90 18 82 18 54 C18 26 26 18 54 18 Z"/>',
  Rounded: '<rect x="18" y="18" width="72" height="72" rx="15"/>',
};
const adaptive = (mask, monochrome = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72"><defs><clipPath id="mask">${mask}</clipPath></defs><g clip-path="url(#mask)"><rect width="108" height="108" fill="${monochrome ? '#DDE6F5' : blue}"/>${monochrome ? glyph().replace('fill="white"', 'fill="#18212F"') : glyph()}</g></svg>`;
const reviewItems = [
  { label: 'Legacy tile', source: svg(true, 1.18), size: 48 },
  ...Object.entries(masks).map(([label, mask]) => ({ label: 'Adaptive ' + label.toLowerCase(), source: adaptive(mask), size: 48 })),
  { label: 'Themed monochrome', source: adaptive(masks.Circle, true), size: 48 },
  { label: 'Notification alpha', source: notificationSvg.replace('fill="white"', 'fill="#18212F"'), size: 24 },
];
const boardWidth = 960, boardHeight = 350;
const board = `<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="${boardHeight}"><rect width="100%" height="100%" fill="#F7F8FA"/><text x="24" y="35" font-family="Arial" font-size="22" fill="#18212F">Remilo R · geometric identity and reminder dot</text><text x="24" y="59" font-family="Arial" font-size="13" fill="#596475">Enlarged mask previews above; actual 48 px / 24 px exports below. Synthetic review, not launcher evidence.</text>${reviewItems.map((item, index) => `<text x="${index * 156 + 24}" y="251" font-family="Arial" font-size="12" fill="#596475">${item.label}</text>`).join('')}</svg>`;
const composites = [];
for (const [index, item] of reviewItems.entries()) {
  const original = await sharp(Buffer.from(item.source)).resize(item.size, item.size).png().toBuffer();
  composites.push({ input: await sharp(original).resize(112, 112, { kernel: 'nearest' }).png().toBuffer(), left: index * 156 + 32, top: 96 });
  composites.push({ input: original, left: index * 156 + 64, top: 275 });
}
await write('verification/local/brand/icon-review.png', await sharp(Buffer.from(board)).composite(composites).png().toBuffer());
console.log('Exported Remilo R adaptive, monochrome, legacy, splash, and notification variants; review: verification/local/brand/icon-review.png.');
