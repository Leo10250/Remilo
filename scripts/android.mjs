import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, run, toolEnvironment } from './tools.mjs';

const mode = process.argv[2];
const env = toolEnvironment();
if (!env.JAVA_HOME || !env.ANDROID_HOME || !existsSync(env.ANDROID_HOME)) {
  throw new Error('Set JAVA_HOME (JDK 17) and ANDROID_HOME; see README setup.');
}
if (mode === 'beta' && !existsSync(join(root, 'android/signing.properties'))) {
  throw new Error('Private beta signing is missing. Run scripts/create-signing.mjs first.');
}
const args = mode === 'verify'
  ? [':remilo-alarm:testDebugUnitTest', ':remilo-alarm:lintDebug', ':app:lintRelease', ':app:assembleRelease']
  : mode === 'beta' ? [':app:assembleRelease', '-Premilo.requireSigning=true'] : null;
if (!args) throw new Error('Expected verify or beta mode.');
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
  [...args, '-PreactNativeArchitectures=arm64-v8a', '--console=plain'],
  { cwd: join(root, 'android'), env });
