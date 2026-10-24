import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_FILE = path.join(ROOT, 'memory', 'history.jsonl');
const STATUS = new Set(['watched', 'metadata_only', 'reference_only']);
const VIEW_MODES = new Set(['full_playback', 'frames', 'subtitle', 'frames+subtitle', 'ai_review', 'metadata', 'reference']);
const MEDIA = new Set(['video', 'post', 'thread', 'repo']);

export function dataFile(env = process.env) {
  return env.WATCH_HISTORY_FILE || DEFAULT_FILE;
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function validate(record) {
  if (!record || typeof record !== 'object') throw new Error('record must be an object');
  for (const key of ['platform', 'content_id', 'title', 'started_at']) {
    if (!record[key] || typeof record[key] !== 'string') throw new Error(`missing/invalid ${key}`);
  }
  if (record.progress != null && (typeof record.progress !== 'number' || record.progress < 0 || record.progress > 1)) {
    throw new Error('progress must be 0..1');
  }
  if (record.rating != null && (typeof record.rating !== 'number' || record.rating < 1 || record.rating > 5)) {
    throw new Error('rating must be 1..5');
  }
  if (record.status && !STATUS.has(record.status)) throw new Error('invalid status');
  if (record.seen != null && typeof record.seen !== 'boolean') throw new Error('seen must be boolean');
  if (record.view_mode && !VIEW_MODES.has(record.view_mode)) throw new Error('invalid view_mode');
  if (record.media_type && !MEDIA.has(record.media_type)) throw new Error('invalid media_type');
  if (record.completed != null && typeof record.completed !== 'boolean') throw new Error('completed must be boolean');
  if (record.tags != null && (!Array.isArray(record.tags) || !record.tags.every((t) => typeof t === 'string'))) {
    throw new Error('tags must be string[]');
  }
}

export function readAll(file = dataFile()) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

export function append(record, file = dataFile()) {
  validate(record);
  const now = new Date().toISOString();
  const rec = {
    ...record,
    id: record.id || `${record.platform}:${record.content_id}`,
    status: record.status || 'metadata_only',
    private: record.private !== false,
    created_at: record.created_at || now,
    updated_at: now,
  };
  ensureDir(file);
  fs.appendFileSync(file, JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}

function ts(value) {
  const n = Date.parse(String(value || ''));
  return Number.isFinite(n) ? n : 0;
}

export function query({ platform, status, q, since, until, limit = 100, offset = 0 } = {}, file = dataFile()) {
  limit = Math.max(1, Math.min(Number(limit) || 100, 500));
  offset = Math.max(0, Number(offset) || 0);
  let items = readAll(file).sort((a, b) => ts(b.started_at) - ts(a.started_at));
  if (platform) items = items.filter((x) => x.platform === platform);
  if (status) items = items.filter((x) => x.status === status);
  if (since) {
    const s = ts(since);
    items = items.filter((x) => (s ? ts(x.started_at) >= s : String(x.started_at) >= since));
  }
  if (until) {
    const u = ts(until);
    items = items.filter((x) => (u ? ts(x.started_at) <= u : String(x.started_at) <= until));
  }
  if (q) {
    const needle = String(q).toLowerCase();
    items = items.filter((x) => [x.title, x.creator, ...(Array.isArray(x.tags) ? x.tags : [])].join(' ').toLowerCase().includes(needle));
  }
  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return { total, limit, offset, items: page };
}

export function stats(file = dataFile()) {
  const items = readAll(file);
  let last = null;
  for (const x of items) {
    if (x.started_at && (!last || ts(x.started_at) > ts(last))) last = x.started_at;
  }
  return {
    count: items.length,
    completed: items.filter((x) => x.completed).length,
    platforms: [...new Set(items.map((x) => x.platform))],
    last_at: last,
  };
}
