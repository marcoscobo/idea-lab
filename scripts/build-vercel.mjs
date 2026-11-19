import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public');
const output = path.join(root, 'dist');
const allowed = new Set(['index.html', 'app.mjs', 'styles.css', 'workflow.mjs', 'loop-runner.mjs', 'examples.mjs', 'demo.mjs', 'favicon.svg']);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of await readdir(source)) {
  if (allowed.has(file)) await cp(path.join(source, file), path.join(output, file));
}
console.log('Built public interface in dist/ (no private settings or credentials).');
