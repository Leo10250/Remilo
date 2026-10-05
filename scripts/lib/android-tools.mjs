import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { root, toolEnvironment, localNode, execute, checked, WorkflowError } from '../tools.mjs';

export const APP_ID = 'com.remilo.app';
export const BUILD_TOOLS = '36.0.0';
export function androidTools(env = toolEnvironment()) {
  if (!env.ANDROID_HOME) throw new WorkflowError('SDK_MISSING', 'Android SDK is missing. Set ANDROID_HOME; see README. Run npm run doctor.');
  const tools = { env, sdk: env.ANDROID_HOME,
    adb: join(env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'),
    aapt: join(env.ANDROID_HOME, 'build-tools', BUILD_TOOLS, process.platform === 'win32' ? 'aapt.exe' : 'aapt'),
    signer: join(env.ANDROID_HOME, 'build-tools', BUILD_TOOLS, 'lib/apksigner.jar'),
    java: env.JAVA_HOME ? join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : null };
  return tools;
}
export function requireFiles(tools, keys) {
  for (const key of keys) if (!tools[key] || !existsSync(tools[key])) throw new WorkflowError('TOOL_MISSING', `${key} is missing${tools[key] ? ` at ${tools[key]}` : ''}. Run npm run doctor.`);
}
export function checkSigning(workspace = root) {
  const path = join(workspace, 'android/signing.properties');
  if (!existsSync(path)) throw new WorkflowError('SIGNING_MISSING', 'Missing android/signing.properties. Restore the existing beta key and properties; create a key only for a new installation identity.');
  const content = readFileSync(path, 'utf8');
  const get = (key) => content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim();
  const storeFile = get('storeFile');
  if (!storeFile || !get('keyAlias') || !get('storePassword') || !get('keyPassword')) throw new WorkflowError('SIGNING_INVALID', 'Signing configuration is incomplete. Restore the existing properties; values are not printed.');
  if (!existsSync(resolve(workspace, 'android/app', storeFile))) throw new WorkflowError('KEY_MISSING', 'The configured beta keystore is missing. Restore it securely; do not replace an existing signing identity.');
}
export function configuredVersions(workspace = root) {
  const app = JSON.parse(readFileSync(join(workspace, 'app.json'), 'utf8')).expo;
  const pkg = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(workspace, 'package-lock.json'), 'utf8'));
  const gradle = readFileSync(join(workspace, 'android/app/build.gradle'), 'utf8');
  const name = gradle.match(/\bversionName\s+["']([^"']+)["']/)?.[1];
  const code = Number(gradle.match(/\bversionCode\s+(\d+)/)?.[1]);
  if (!name || !Number.isInteger(code) || code < 1 || [pkg.version, lock.version, lock.packages?.['']?.version, app.version].some((v) => v !== name) || code !== app.android?.versionCode || app.android?.package !== APP_ID) {
    throw new WorkflowError('VERSION_CONFLICT', 'app.json, package.json, package-lock.json and native Android identity/version disagree. Update them together.');
  }
  return { package: APP_ID, versionName: name, versionCode: code };
}
export function parseBadging(output) {
  const pkg = output.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
  if (!pkg) throw new WorkflowError('APK_INVALID', 'Could not inspect APK package/version.');
  return { package: pkg[1], versionCode: Number(pkg[2]), versionName: pkg[3],
    minSdk: Number(output.match(/^sdkVersion:'(\d+)'/m)?.[1]),
    targetSdk: Number(output.match(/^targetSdkVersion:'(\d+)'/m)?.[1]),
    abis: [...(output.match(/^native-code:\s*(.*)$/m)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]),
    debuggable: /^application-debuggable/m.test(output),
    launcher: output.match(/^launchable-activity: name='([^']+)'/m)?.[1] ?? null };
}
export async function inspectApk(path, tools, { allowUnsigned = false } = {}) {
  requireFiles(tools, ['aapt', 'signer', 'java']);
  const badging = await checked(tools.aapt, ['dump', 'badging', path], { env: tools.env });
  const metadata = parseBadging(badging.stdout);
  const contents = await checked(tools.aapt, ['list', path], { env: tools.env });
  metadata.bundledJs = contents.stdout.split(/\r?\n/).includes('assets/index.android.bundle');
  const signature = await execute(tools.java, ['-jar', tools.signer, 'verify', '--print-certs', path], { env: tools.env });
  const signers = [...signature.stdout.matchAll(/certificate SHA-256 digest:\s*([a-f0-9]{64})/gi)].map((m) => m[1].toLowerCase()).sort();
  if (signature.status !== 0 || !signers.length) {
    if (!allowUnsigned) throw new WorkflowError('APK_UNSIGNED', 'APK signature verification failed. Rebuild with npm run build:beta; no install was attempted.');
    metadata.signed = false; metadata.signers = [];
  } else { metadata.signed = true; metadata.signers = signers; }
  return metadata;
}
export function validateApk(apk, abi, expected, requireSigned = true) {
  if (requireSigned && !apk.signed) throw new WorkflowError('APK_UNSIGNED', 'Only a verified signed beta APK can be deployed.');
  if (apk.package !== APP_ID) throw new WorkflowError('APK_PACKAGE', `APK is not ${APP_ID}.`);
  if (apk.debuggable || !apk.bundledJs || apk.minSdk !== 34 || apk.targetSdk !== 36 || !/^com\.remilo\.app\.[A-Za-z0-9_.$]+$/.test(apk.launcher ?? '')) throw new WorkflowError('APK_CONFIGURATION', 'APK is not the expected Android 14+ bundled release configuration.');
  if (!apk.abis.includes(abi)) throw new WorkflowError('APK_ABI', `APK does not contain ${abi}. Rebuild for the selected device.`);
  if (expected && (apk.versionName !== expected.versionName || apk.versionCode !== expected.versionCode)) throw new WorkflowError('APK_VERSION', 'Built APK version differs from the repository configuration.');
}
export function validateUpdate(candidate, installed) {
  if (!installed) return;
  if (candidate.package !== installed.package || JSON.stringify(candidate.signers) !== JSON.stringify(installed.signers)) throw new WorkflowError('SIGNATURE_CONFLICT', 'The installed app uses a different signing identity. Restore its original beta key. No uninstall or data clearing was attempted.');
  if (candidate.versionCode < installed.versionCode) throw new WorkflowError('DOWNGRADE', 'The installed app has a higher versionCode. Build a newer version; no downgrade was attempted.');
}
export async function toolVersions(tools) {
  requireFiles(tools, ['java', 'aapt', 'signer']);
  const [node, java, aapt, adb] = await Promise.all([
    checked(localNode(), ['--version'], { env: tools.env }), checked(tools.java, ['-version'], { env: tools.env }),
    checked(tools.aapt, ['version'], { env: tools.env }),
    existsSync(tools.adb) ? checked(tools.adb, ['version'], { env: tools.env }) : null,
  ]);
  const nodeVersion = node.stdout.trim().replace(/^v/, '');
  const javaVersion = (java.stderr + java.stdout).match(/version "([^"]+)"/)?.[1] ?? 'unknown';
  const pinned = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
  if (nodeVersion !== pinned || !javaVersion.startsWith('17.')) throw new WorkflowError('TOOL_VERSION', `Selected Node ${nodeVersion} / Java ${javaVersion} differs from required Node ${pinned} / JDK 17. Run npm run doctor.`);
  return { node: nodeVersion, java: javaVersion, buildTools: BUILD_TOOLS,
    aapt: aapt.stdout.trim(), adb: adb?.stdout.match(/^Android Debug Bridge version (.+)$/m)?.[1] ?? null,
    paths: { node: localNode(), java: tools.java, sdk: tools.sdk, aapt: tools.aapt, apksigner: tools.signer, adb: tools.adb } };
}
