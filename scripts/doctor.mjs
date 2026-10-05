import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { root, toolEnvironment, localNode, execute, findExecutable } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools, checkSigning, configuredVersions } from './lib/android-tools.mjs';

export async function diagnose() {
  const env = toolEnvironment(), checks = [];
  const add = (id, status, detail, remedy = null) => checks.push({ id, status, detail, remedy });
  const version = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
  const node = await execute(localNode(), ['--version'], { env });
  add('node', node.status === 0 && node.stdout.trim() === `v${version}` ? 'ok' : 'error', `${localNode()} — ${node.stdout.trim()}`, `Select Node ${version}; see .nvmrc.`);
  if (process.env.REMILO_ORIGINAL_NODE && resolve(process.env.REMILO_ORIGINAL_NODE).toLowerCase() !== resolve(localNode()).toLowerCase()) add('node-override', 'warning', `Command was re-executed with pinned Node; original runtime: ${process.env.REMILO_ORIGINAL_NODE}.`);
  let tools;
  try { tools = androidTools(env); } catch (e) { add('android-tools', 'error', e.message, 'Set JAVA_HOME (JDK 17) and ANDROID_HOME; see README.'); }
  if (tools) {
    if (tools.java && existsSync(tools.java)) {
      const result = await execute(tools.java, ['-version'], { env });
      const javaVersion = (result.stderr + result.stdout).match(/version "([^"]+)"/)?.[1];
      add('java', result.status === 0 && javaVersion?.startsWith('17.') ? 'ok' : 'error', `${tools.java} — ${javaVersion ?? 'unknown'}`, 'Select JDK 17 via JAVA_HOME.');
    } else add('java', 'error', 'JDK executable is missing.', 'Set JAVA_HOME to a JDK 17 directory.');
    for (const [id, path] of Object.entries({ adb: tools.adb, aapt: tools.aapt, apksigner: tools.signer,
      platform36: join(tools.sdk, 'platforms/android-36/android.jar'), buildTools35: join(tools.sdk, 'build-tools/35.0.0'),
      ndk: join(tools.sdk, 'ndk/27.1.12297006'), cmake: join(tools.sdk, 'cmake/3.22.1') })) {
      add(id, existsSync(path) ? 'ok' : 'error', path, 'Install the README-listed SDK packages with sdkmanager.');
    }
    if (existsSync(tools.adb)) {
      const adb = await execute(tools.adb, ['version'], { env });
      add('adb-version', adb.status === 0 ? 'ok' : 'error', adb.stdout.trim(), 'Restore platform-tools using sdkmanager.');
    }
    const props = join(root, 'android/local.properties');
    const localSdk = existsSync(props) ? readFileSync(props, 'utf8').match(/^sdk\.dir=(.*)$/m)?.[1].trim().replaceAll('\\:', ':').replaceAll('\\\\', '\\') : null;
    if (localSdk && resolve(localSdk).toLowerCase() !== resolve(tools.sdk).toLowerCase()) add('sdk-conflict', 'error', 'android/local.properties sdk.dir differs from the selected SDK.', 'Point both to the same SDK, or remove only the obsolete sdk.dir entry.');
    for (const key of ['JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT']) {
      const original = process.env[`REMILO_ORIGINAL_${key}`] ?? process.env[key];
      if (original && env[key] && resolve(original).toLowerCase() !== resolve(env[key]).toLowerCase()) add(`override-${key}`, 'warning', `Project-local tools override ${key}; selected ${env[key]}.`);
    }
    const pathJava = findExecutable('java');
    if (pathJava && tools.java && resolve(pathJava).toLowerCase() !== resolve(tools.java).toLowerCase()) add('java-path-override', 'warning', `Java on PATH is ${pathJava}; builds use ${tools.java}.`);
  }
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  for (const name of ['expo', 'react-native', 'expo-modules-core', 'expo-router', 'typescript', 'eslint', 'vitest']) {
    const path = join(root, 'node_modules', name, 'package.json');
    const version = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).version : null;
    add(`dependency-${name}`, version && version === lock.packages?.[`node_modules/${name}`]?.version ? 'ok' : 'error', `${name}: ${version ?? 'missing'}`, 'Run npm ci with the selected Node.');
  }
  add('gradle-wrapper', existsSync(join(root, 'android/gradle/wrapper/gradle-wrapper.jar')) ? 'ok' : 'error', 'Committed Gradle wrapper', 'Restore the wrapper from Git; never regenerate android/.');
  try { configuredVersions(); add('versions', 'ok', 'JavaScript and Android identity/version agree.'); } catch (e) { add('versions', 'error', e.message); }
  try { checkSigning(); add('signing', 'ok', 'Existing beta signing configuration and keystore are present.'); }
  catch (e) { add('signing', 'warning', e.message, 'Restore existing signing material for deployment; unsigned CI checks remain available.'); }
  return { ok: !checks.some((c) => c.status === 'error'), checks, signingReady: checks.find((c) => c.id === 'signing')?.status === 'ok' };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await cli(async () => {
  const flags = options(process.argv.slice(2)); allowedOptions(flags, ['help', 'json']);
  if (flags.help) return console.log('npm run doctor -- [--json]\nRead-only environment diagnosis. No downloads, licensing, key creation or configuration changes.');
  const report = await diagnose();
  if (flags.json) console.log(JSON.stringify(report));
  else for (const check of report.checks) console.log(`${check.status.toUpperCase()} ${check.id}: ${check.detail}${check.status !== 'ok' && check.remedy ? `\n  ${check.remedy}` : ''}`);
  if (!report.ok) process.exitCode = 1;
});
