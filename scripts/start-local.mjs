import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tools = path.resolve(root, '../tools');
const logs = path.join(root, 'logs'); fs.mkdirSync(logs, { recursive: true });
const php = path.join(tools, 'php/php.exe');
const mysql = path.join(tools, 'mysql/mysql-8.4.13-winx64');
const services = [
  { name: 'mysql', port: 3307, bin: path.join(mysql, 'bin/mysqld.exe'), args: ['--no-defaults', `--basedir=${mysql}`, `--datadir=${path.join(tools, 'mysql-data')}`, '--bind-address=127.0.0.1', '--port=3307', '--mysqlx=OFF', '--console'], cwd: root },
  { name: 'laravel', port: 8000, bin: php, args: ['artisan', 'serve', '--host=127.0.0.1', '--port=8000', '--no-reload'], cwd: path.join(root, 'backend') },
  { name: 'vite', port: 8080, bin: process.execPath, args: ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '8080', '--strictPort'], cwd: root },
];
const listening = port => new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port });
  const done = result => { socket.destroy(); resolve(result); };
  socket.setTimeout(1000); socket.once('connect', () => done(true)); socket.once('error', () => done(false)); socket.once('timeout', () => done(false));
});
for (const service of services) {
  if (await listening(service.port)) { console.log(`${service.name}: already running on ${service.port}`); continue; }
  if (!fs.existsSync(service.bin)) throw new Error(`Missing ${service.bin}. See README.md for a standard installation.`);
  const out = fs.openSync(path.join(logs, `${service.name}.out.log`), 'a');
  const err = fs.openSync(path.join(logs, `${service.name}.err.log`), 'a');
  const child = spawn(service.bin, service.args, { cwd: service.cwd, detached: true, windowsHide: true, stdio: ['ignore', out, err] });
  child.unref(); fs.closeSync(out); fs.closeSync(err);
  console.log(`${service.name}: starting on ${service.port}`);
}
console.log('Open http://127.0.0.1:8080/ . Data is preserved; this launcher never resets or seeds the database.');
