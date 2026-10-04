import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, run, toolEnvironment } from './tools.mjs';

const properties = join(root, 'android/signing.properties');
const store = join(root, '.tooling/signing/remilo-beta.jks');
if (existsSync(properties) || existsSync(store)) throw new Error('Signing already exists; refusing to overwrite.');
mkdirSync(join(root, '.tooling/signing'), { recursive: true });
const password = randomBytes(24).toString('hex');
const env = { ...toolEnvironment(), REMILO_KEY_PASSWORD: password };
run(join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool'), [
  '-genkeypair', '-keystore', store, '-storetype', 'JKS', '-alias', 'remilo-beta',
  '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
  '-dname', 'CN=Remilo Private Beta', '-storepass:env', 'REMILO_KEY_PASSWORD', '-keypass:env', 'REMILO_KEY_PASSWORD',
], { env });
writeFileSync(properties, `storeFile=${store.replaceAll('\\', '/') }\nstorePassword=${password}\nkeyAlias=remilo-beta\nkeyPassword=${password}\n`, { mode: 0o600 });
console.log('Created local beta signing identity. Back up the ignored keystore and properties securely.');
