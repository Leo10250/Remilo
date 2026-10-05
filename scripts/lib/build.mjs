import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root, checked, localNode, WorkflowError } from '../tools.mjs';
import { readJson } from './files.mjs';
import { androidTools, checkSigning, configuredVersions, inspectApk, validateApk, toolVersions } from './android-tools.mjs';

export async function verifyShared({ json = false } = {}) {
  const checks = [];
  const tasks = [
    ['typecheck', [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']],
    ['lint', [join(root, 'node_modules/eslint/bin/eslint.js'), '.']],
    ['shared tests', [join(root, 'node_modules/vitest/vitest.mjs'), 'run']],
    ['tooling tests', ['--test', ...readdirSync(join(root, 'scripts/tests')).filter((p) => p.endsWith('.test.node.mjs')).map((p) => join(root, 'scripts/tests', p))]],
  ];
  for (const [command, args] of tasks) {
    await checked(localNode(), args, { stream: true, stderrStream: json, timeout: 300_000 });
    checks.push({ command, result: 'passed', completedAt: new Date().toISOString() });
  }
  return checks;
}

export function buildEnvironment(env) {
  const clean = { ...env, NODE_ENV: 'production' };
  delete clean.REMILO_UI_PREVIEW; delete clean.EXPO_NO_WEB_SETUP;
  return clean;
}

export function releaseApkPath(workspace = root) {
  const directory = join(workspace, 'android/app/build/outputs/apk/release');
  const listing = readJson(join(directory, 'output-metadata.json'));
  if (!listing) throw new WorkflowError('APK_MISSING', 'No local release output is available. Run npm run build:beta.');
  if (listing?.elements?.length !== 1) throw new WorkflowError('BUILD_ARTIFACT', 'Expected exactly one release APK output. Run npm run build:beta.');
  const filename = listing.elements[0].outputFile;
  if (!/^[A-Za-z0-9_.-]+\.apk$/.test(filename)) throw new WorkflowError('BUILD_ARTIFACT', 'Invalid APK output filename.');
  const path = join(directory, filename);
  if (!existsSync(path)) throw new WorkflowError('APK_MISSING', 'Release APK is missing. Run npm run build:beta.');
  return path;
}

// Gradle owns incremental assembly. Run only one artifact-producing command per checkout.
export async function buildRelease({ abi = 'arm64-v8a', verify = false, requireSigning = true, json = false } = {}) {
  if (!['arm64-v8a', 'x86_64'].includes(abi)) throw new WorkflowError('ABI', 'Use --abi arm64-v8a or --abi x86_64.');
  const tools = androidTools(); await toolVersions(tools);
  const expected = configuredVersions();
  const signed = existsSync(join(root, 'android/signing.properties'));
  if (requireSigning || signed) checkSigning();
  if (!existsSync(join(root, 'node_modules/expo/package.json'))) throw new WorkflowError('DEPENDENCIES_MISSING', 'Install project dependencies with npm ci before building.');
  const wrapper = join(root, 'android/gradle/wrapper/gradle-wrapper.jar');
  if (!existsSync(wrapper)) throw new WorkflowError('WRAPPER_MISSING', 'Restore the committed Android Gradle wrapper from Git.');
  const tasks = verify ? [':remilo-alarm:testDebugUnitTest', ':remilo-alarm:lintDebug', ':app:lintRelease', ':app:assembleRelease'] : [':app:assembleRelease'];
  // Invoke the committed wrapper JAR directly to preserve arguments on Windows, including paths with spaces.
  await checked(tools.java, ['-Xmx64m', '-Xms64m', '-Dorg.gradle.appname=gradlew', '-classpath', wrapper,
    'org.gradle.wrapper.GradleWrapperMain', ...tasks, ...(requireSigning ? ['-Premilo.requireSigning=true'] : []),
    `-PreactNativeArchitectures=${abi}`, '--console=plain', '--no-daemon'],
  { cwd: join(root, 'android'), env: buildEnvironment(tools.env), stream: true, stderrStream: json, timeout: 1_800_000 });
  const path = releaseApkPath();
  const metadata = await inspectApk(path, tools, { allowUnsigned: !signed });
  validateApk(metadata, abi, expected, signed || requireSigning);
  const build = { builtAt: new Date().toISOString(), variant: 'release', abi, apk: { path, metadata } };
  if (!json) console.log(`Built ${metadata.package} ${metadata.versionName} (${metadata.versionCode}), ${abi}, signed=${metadata.signed}\nAPK: ${path}`);
  return build;
}
