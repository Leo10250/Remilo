import { existsSync, unlinkSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { root, localEvidence, checked, localNode, WorkflowError } from '../tools.mjs';
import { sha256, fileHash, readJson, writeJson, withReleaseLock } from './files.mjs';
import { androidTools, checkSigning, configuredVersions, inspectApk, validateApk, toolVersions } from './android-tools.mjs';

export const receiptPath = join(localEvidence, 'build-receipt.json');
const sharedPath = join(localEvidence, 'shared-checks.json');
export async function sourceSnapshot(workspace = root) {
  const git = async (args) => (await checked('git', args, { cwd: workspace })).stdout;
  const commit = (await git(['rev-parse', 'HEAD'])).trim();
  const dirty = (await git(['status', '--porcelain'])).trim().length > 0;
  const paths = (await git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
  const inputs = paths.filter((p) => /^(src\/|modules\/|android\/|assets\/|scripts\/)/.test(p)
    || /^(package(-lock)?\.json|app\.(json|config\.js)|metro\.config\.js|babel\.config\.js|tsconfig\.json|\.nvmrc)$/.test(p));
  const records = [...new Set(inputs)].sort().map((path) => {
    const file = join(workspace, path);
    return [path, existsSync(file) && lstatSync(file).isFile() ? fileHash(file) : 'deleted'];
  });
  return { commit, dirty, inputSha256: sha256(JSON.stringify(records)) };
}
export function assertStable(before, after) {
  if (before.inputSha256 !== after.inputSha256 || before.commit !== after.commit) throw new WorkflowError('SOURCE_CHANGED', 'Build inputs or Git commit changed during the command. No source attribution was recorded; retry once edits have finished.');
}
export function validateReceipt(receipt, actualHash) {
  if (!receipt || receipt.schemaVersion !== 1 || !receipt.source?.inputSha256 || !receipt.apk?.path) throw new WorkflowError('RECEIPT_MISSING', 'No valid build receipt is available. Run npm run build:beta or deploy without --install-only.');
  if (receipt.apk.sha256 !== actualHash) throw new WorkflowError('RECEIPT_STALE', 'APK hash does not match its build receipt. Rebuild; no install was attempted.');
  return receipt;
}
export async function existingBuild(tools = androidTools()) {
  const receipt = readJson(receiptPath);
  if (!receipt?.apk?.path || !existsSync(receipt.apk.path)) throw new WorkflowError('RECEIPT_MISSING', 'Recorded APK is missing. Run npm run build:beta or deploy without --install-only.');
  validateReceipt(receipt, fileHash(receipt.apk.path));
  const metadata = await inspectApk(receipt.apk.path, tools);
  if (JSON.stringify(metadata) !== JSON.stringify(receipt.apk.metadata)) throw new WorkflowError('RECEIPT_STALE', 'Recorded APK metadata does not match the actual artifact. Rebuild.');
  return receipt;
}
export async function verifyShared({ json = false } = {}) {
  const before = await sourceSnapshot(); const checks = [];
  const tasks = [
    ['typecheck', [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']],
    ['lint', [join(root, 'node_modules/eslint/bin/eslint.js'), '.']],
    ['shared tests', [join(root, 'node_modules/vitest/vitest.mjs'), 'run']],
    ['tooling tests', ['--test', ...readdirSync(join(root, 'scripts/tests')).filter((p) => p.endsWith('.test.node.mjs')).map((p) => join(root, 'scripts/tests', p))]],
  ];
  for (const [command, args] of tasks) {
    await checked(localNode(), args, { stream: true, stderrStream: json, timeout: 300_000 });
    checks.push({ command, result: 'passed', completedAt: new Date().toISOString(), inputSha256: before.inputSha256 });
  }
  assertStable(before, await sourceSnapshot());
  writeJson(sharedPath, { schemaVersion: 1, source: before, checks }); return checks;
}
export function buildEnvironment(env) {
  const clean = { ...env, NODE_ENV: 'production' };
  delete clean.REMILO_UI_PREVIEW; delete clean.EXPO_NO_WEB_SETUP;
  return clean;
}
export async function buildRelease({ abi = 'arm64-v8a', verify = false, requireSigning = true, json = false, locked = false } = {}) {
  const work = async () => {
    if (!['arm64-v8a', 'x86_64'].includes(abi)) throw new WorkflowError('ABI', 'Use --abi arm64-v8a or --abi x86_64.');
    const tools = androidTools(); const versions = await toolVersions(tools); const expected = configuredVersions();
    const signed = existsSync(join(root, 'android/signing.properties'));
    if (requireSigning || signed) checkSigning();
    const before = await sourceSnapshot();
    // An interrupted/failed replacement build must not retain the prior source receipt.
    if (existsSync(receiptPath)) unlinkSync(receiptPath);
    const tasks = verify ? [':remilo-alarm:testDebugUnitTest', ':remilo-alarm:lintDebug', ':app:lintRelease', ':app:assembleRelease'] : [':app:assembleRelease'];
    // Invoke the committed wrapper JAR directly to avoid cmd.exe expansion of paths/arguments.
    await checked(tools.java, ['-Xmx64m', '-Xms64m', '-Dorg.gradle.appname=gradlew', '-classpath',
      join(root, 'android/gradle/wrapper/gradle-wrapper.jar'), 'org.gradle.wrapper.GradleWrapperMain', ...tasks,
      ...(requireSigning ? ['-Premilo.requireSigning=true'] : []), `-PreactNativeArchitectures=${abi}`, '--console=plain', '--no-daemon'],
    { cwd: join(root, 'android'), env: buildEnvironment(tools.env), stream: true, stderrStream: json, timeout: 1_800_000, protectRelease: true });
    const directory = join(root, 'android/app/build/outputs/apk/release');
    const listing = readJson(join(directory, 'output-metadata.json'));
    if (listing?.elements?.length !== 1) throw new WorkflowError('BUILD_ARTIFACT', 'Expected exactly one release APK output.');
    const filename = listing.elements[0].outputFile;
    if (!/^[A-Za-z0-9_.-]+\.apk$/.test(filename)) throw new WorkflowError('BUILD_ARTIFACT', 'Invalid APK output filename.');
    const path = join(directory, filename);
    const metadata = await inspectApk(path, tools, { allowUnsigned: !signed });
    validateApk(metadata, abi, expected, signed || requireSigning);
    assertStable(before, await sourceSnapshot());
    const shared = readJson(sharedPath);
    const checks = shared?.source?.inputSha256 === before.inputSha256 ? [...shared.checks] : [];
    if (verify) checks.push({ command: 'Android unit tests, module/app lint, release assembly', result: 'passed', completedAt: new Date().toISOString(), inputSha256: before.inputSha256 });
    const receipt = { schemaVersion: 1, builtAt: new Date().toISOString(), variant: 'release', abi, source: before,
      tools: versions, lockfileSha256: fileHash(join(root, 'package-lock.json')),
      apk: { path, sha256: fileHash(path), metadata }, checks };
    writeJson(receiptPath, receipt);
    if (!json) console.log(`Build receipt: ${receiptPath}\n${metadata.versionName} (${metadata.versionCode}), ${abi}, signed=${metadata.signed}\nAPK: ${path}`);
    return receipt;
  };
  return locked ? work() : withReleaseLock(work);
}
