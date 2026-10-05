// Export the owned SVG geometry to Android raster/vector variants. No Prebuild.
// Usage: node scripts/brand.mjs [path-to-sharp-package]
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const blue = '#245CD6';
const bell = 'M44 32 C44 27 47 24 54 24 C61 24 64 27 64 32 C72 36 76 42 76 54 L76 65 L82 73 Q83 76 80 77 L28 77 Q25 76 26 73 L32 65 L32 54 C32 42 36 36 44 32 Z M51 42 L57 42 L57 54 L66 59 L63 64 L51 57 Z M48 81 Q48 88 54 88 Q60 88 60 81 Z';
const glyph = `<g transform="translate(8.1 8.1) scale(.85)"><path fill="white" fill-rule="evenodd" d="${bell}"/></g>`;
const svg = (background = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${background ? `<rect width="108" height="108" fill="${blue}"/>` : ''}${glyph}</svg>`;
const write = async (path, data) => { await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true }); await writeFile(path, data); };
await write('assets/brand/remilo.svg', svg(true));
await write('assets/brand/remilo-mark.svg', svg());
const raster = async (path, size, background = false) => {
  const image = sharp(Buffer.from(svg(background))).resize(size, size);
  await write(path, await (path.endsWith('.webp') ? image.webp({ lossless: true }) : image.png()).toBuffer());
};
for (const [name, size, bg] of [['icon', 1024, true], ['android-icon-foreground', 432, false], ['android-icon-monochrome', 432, false], ['splash-icon', 288, true], ['favicon', 48, true]]) {
  await raster(`assets/images/${name}.png`, size, bg);
}
await write('assets/images/android-icon-background.png', await sharp({ create: { width: 432, height: 432, channels: 4, background: blue } }).png().toBuffer());
for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  for (const name of ['ic_launcher', 'ic_launcher_round']) await raster(`android/app/src/main/res/mipmap-${density}/${name}.webp`, 48 * scale, true);
  for (const name of ['ic_launcher_foreground', 'ic_launcher_monochrome']) await raster(`android/app/src/main/res/mipmap-${density}/${name}.webp`, 108 * scale);
  await write(`android/app/src/main/res/mipmap-${density}/ic_launcher_background.webp`, await sharp({ create: { width: 108 * scale, height: 108 * scale, channels: 4, background: blue } }).webp({ lossless: true }).toBuffer());
  await raster(`android/app/src/main/res/drawable-${density}/splashscreen_logo.png`, 76 * scale, true);
}
const vector = `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><group android:translateX="8.1" android:translateY="8.1" android:scaleX="0.85" android:scaleY="0.85"><path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="${bell}"/></group></vector>\n`;
await write('android/app/src/main/res/drawable/ic_remilo_foreground.xml', vector);
await write('modules/remilo-alarm/android/src/main/res/drawable/ic_remilo_notification.xml', vector.replaceAll('108dp', '24dp'));
for (const name of ['ic_launcher', 'ic_launcher_round']) await write(`android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/iconBackground"/><foreground android:drawable="@drawable/ic_remilo_foreground"/><monochrome android:drawable="@drawable/ic_remilo_foreground"/></adaptive-icon>\n`);
console.log('Exported Remilo brand variants from one vector geometry.');
