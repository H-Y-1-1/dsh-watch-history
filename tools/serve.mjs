import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.env.WATCH_HISTORY_ROOT || process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, 'out');
const histFile = path.join(root, 'memory', 'history.jsonl');
const port = Number(process.env.WH_PORT || 8787);

function render() {
  const r = spawnSync(process.execPath, [path.join(here, 'render.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WATCH_HISTORY_ROOT: root },
  });
  if (r.status !== 0) console.error('[serve] render failed');
}

render();

const clients = new Set();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/history.html';
  const file = path.join(outDir, path.normalize(rel).replace(/^[/\\]+/, ''));
  const relative = path.relative(outDir, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve] http://127.0.0.1:${port}/`);
  console.log('[serve] 数据变了才推送更新（SSE /events）');
});

let timer = null;
try {
  fs.watch(histFile, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      render();
      for (const res of clients) {
        try { res.write(`data: ${JSON.stringify({ type: 'history-updated', at: Date.now() })}\n\n`); } catch { /* 客户端已断 */ }
      }
    }, 350);
  });
} catch (e) {
  console.error('[serve] watch failed:', e.message);
}
