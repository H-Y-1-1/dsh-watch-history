import { dataFile, query, stats } from './store.mjs';
import { addRecord } from './add.mjs';

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(text);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        const err = new Error('payload too large');
        err.status = 413;
        reject(err);
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * 纯 Node HTTP handler；由 DSH 插件在 P1 用 ctx.webServer 挂载。
 * 只监听本机，无鉴权，不要暴露公网。
 */
export function createHandler({ file = dataFile(), maxBody = 1024 * 1024, path = '/api/watch-history', config } = {}) {
  return async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); } catch { return json(res, 400, { ok: false, error: 'bad-url' }); }
    if (url.pathname !== path) return json(res, 404, { ok: false, error: 'not-found' });

    try {
      if (req.method === 'GET') {
        const data = query({
          platform: url.searchParams.get('platform') || undefined,
          status: url.searchParams.get('status') || undefined,
          q: url.searchParams.get('q') || undefined,
          since: url.searchParams.get('since') || undefined,
          until: url.searchParams.get('until') || undefined,
          limit: Number(url.searchParams.get('limit') || 100),
          offset: Number(url.searchParams.get('offset') || 0),
        }, file);
        return json(res, 200, { ok: true, data: { ...data, stats: stats(file) } });
      }

      if (req.method === 'POST') {
        const body = await readBody(req, maxBody);
        let record;
        try { record = JSON.parse(body); } catch { return json(res, 400, { ok: false, error: 'bad-json' }); }
        try {
          const saved = await addRecord(record, file, config);
          return json(res, 201, { ok: true, data: saved });
        } catch (e) {
          return json(res, 422, { ok: false, error: e.message });
        }
      }

      return json(res, 405, { ok: false, error: 'method-not-allowed' });
    } catch (e) {
      return json(res, e.status === 413 ? 413 : 500, { ok: false, error: e.message });
    }
  };
}
