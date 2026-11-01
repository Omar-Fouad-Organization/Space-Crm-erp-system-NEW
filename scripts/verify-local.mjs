import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portablePhp = path.resolve(root, '../tools/php/php.exe');
const php = fs.existsSync(portablePhp) ? portablePhp : 'php';
for (const [bin, args, cwd] of [
  [process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.app.json'], root],
  [process.execPath, ['node_modules/eslint/bin/eslint.js', '.'], root],
  [process.execPath, ['node_modules/vite/bin/vite.js', 'build'], root],
  [php, ['vendor/phpunit/phpunit/phpunit'], path.join(root, 'backend')],
]) {
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
