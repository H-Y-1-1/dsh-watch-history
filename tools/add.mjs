import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { addRecord } from '../src/add.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node plugins/watch-history/tools/add.mjs <record.json>');
  process.exit(2);
}

const rec = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const saved = await addRecord(rec);
console.log(JSON.stringify({ ok: true, data: saved }));

const here = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(here, 'render.mjs')], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, WATCH_HISTORY_ROOT: process.cwd() },
});
if (r.status !== 0) console.error('[add] render failed');
