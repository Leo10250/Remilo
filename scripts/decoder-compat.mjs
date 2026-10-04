// Expo 57's query-string is CommonJS; the patched decoder 0.5.0 ships ESM.
// Preserve the upstream algorithm and change only its module packaging.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './tools.mjs';

const directory = join(root, 'node_modules/decode-uri-component');
const sourcePath = join(directory, 'index.js');
const packagePath = join(directory, 'package.json');
const metadata = JSON.parse(readFileSync(packagePath, 'utf8'));
if (metadata.version !== '0.5.0') throw new Error('Review decoder compatibility before changing its version.');
const source = readFileSync(sourcePath, 'utf8');
const upstream = 'export default function decodeUriComponent(encodedURI) {';
const commonjs = 'module.exports = function decodeUriComponent(encodedURI) {';
const original = source.replace(commonjs, upstream);
const hash = createHash('sha256').update(original).digest('hex');
if (hash !== '9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa') {
  throw new Error('Decoder source differs from the reviewed upstream artifact.');
}
writeFileSync(sourcePath, original.replace(upstream, commonjs));
metadata.type = 'commonjs';
writeFileSync(packagePath, `${JSON.stringify(metadata, null, 2)}\n`);
