import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.env.WATCH_HISTORY_ROOT || process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const histFile = path.join(root, 'memory', 'history.jsonl');
const gen = path.join(here, 'render.mjs');

function regen() {
  const r = spawnSync(process.execPath, [gen], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WATCH_HISTORY_ROOT: root },
  });
  if (r.status !== 0) console.error('[history-watch] regen failed');
}

if (!fs.existsSync(histFile)) {
  fs.writeFileSync(histFile, '', 'utf8');
}

let timer = null;
fs.watch(histFile, () => {
  clearTimeout(timer);
  timer = setTimeout(regen, 400);
});

regen();
console.log('[history-watch] watching', histFile);
setInterval(() => {}, 1 << 30);
