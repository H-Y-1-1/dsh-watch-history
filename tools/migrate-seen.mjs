import fs from 'node:fs';
import path from 'node:path';

const root = process.env.WATCH_HISTORY_ROOT || process.cwd();
const file = process.env.WATCH_HISTORY_FILE || path.join(root, 'memory', 'history.jsonl');
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(outDir, `history-backup-seen-${stamp}.jsonl`);
fs.copyFileSync(file, backup);

const records = fs.readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const modeFor = (r) => {
  if (r.view_mode) return r.view_mode;
  if (r.status === 'metadata_only') return 'metadata';
  if (r.status === 'reference_only') return 'reference';
  if (r.status === 'watched') return 'ai_review';
  return 'metadata';
};

for (const r of records) {
  r.view_mode = modeFor(r);
  if (typeof r.seen !== 'boolean') {
    r.seen = r.view_mode === 'full_playback' || r.status === 'watched';
  }
  if (typeof r.completed !== 'boolean') r.completed = false;
}

records.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');

const seen = records.filter((r) => r.seen).length;
const modes = {};
for (const r of records) modes[r.view_mode] = (modes[r.view_mode] || 0) + 1;
console.log(JSON.stringify({
  ok: true,
  backup,
  total: records.length,
  seen,
  unseen: records.length - seen,
  modes,
}, null, 2));
