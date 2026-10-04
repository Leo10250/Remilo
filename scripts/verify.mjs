import { join } from 'node:path';
import { localNode, root, run } from './tools.mjs';

run(localNode(), [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
run(localNode(), [join(root, 'node_modules/eslint/bin/eslint.js'), '.']);
run(localNode(), [join(root, 'node_modules/vitest/vitest.mjs'), 'run']);
