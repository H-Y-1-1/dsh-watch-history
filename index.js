import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './src/server.mjs';
import { addRecord } from './src/add.mjs';
import { loadConfig } from './src/config.mjs';
import { authCookie, cookieValue, newToken, sameOriginOk, sendJson, tokenOk } from './src/auth.mjs';

export const name = 'watch-history';
export const inject = ['webServer', 'tools'];

const AUTH_TOKEN = newToken();

// 默认数据目录在用户 home；本地/目标环境可用 config.json 或 WATCH_HISTORY_FILE 覆盖。
const FALLBACK_FILE = path.join(os.homedir(), '.dsh', 'watch-history', 'history.jsonl');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL_OUTPUT = {
  schema: { type: 'object', properties: {}, additionalProperties: true },
  render: (_args, value) => [{
    type: 'text',
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }],
};

function defineTool(spec) {
  const parameters = spec.parameters && spec.parameters.type
    ? spec.parameters
    : { type: 'object', properties: spec.parameters || {}, additionalProperties: true };
  return { ...spec, parameters, output: TOOL_OUTPUT };
}

export function apply(ctx, config = {}) {
  const runtimeConfig = { ...loadConfig(), ...(config || {}) };
  const file = (runtimeConfig && runtimeConfig.dataFile) || process.env.WATCH_HISTORY_FILE || FALLBACK_FILE;
  const handler = createHandler({ file, config: runtimeConfig });
  const fallbackFile = runtimeConfig.fallbackImage
    ? path.resolve(runtimeConfig.fallbackImage)
    : path.join(HERE, 'assets', 'fallback.svg');
  const fallbackType = path.extname(fallbackFile).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/jpeg';

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/api/watch-history',
    handler: async (req, res) => {
      const pathname = String(req.url || '').split('?')[0];

      if (pathname === '/api/watch-history/bootstrap') {
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method-not-allowed' });
        if (!sameOriginOk(req)) return sendJson(res, 403, { ok: false, error: 'cross-origin denied' });
        res.setHeader('Set-Cookie', authCookie(AUTH_TOKEN));
        return sendJson(res, 200, { ok: true, token: AUTH_TOKEN });
      }

      if (req.method === 'GET' && pathname === '/api/watch-history/fallback') {
        if (!sameOriginOk(req)) return sendJson(res, 403, { ok: false, error: 'cross-origin denied' });
        fs.readFile(fallbackFile, (err, buf) => {
          if (err) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('fallback icon not found');
            return;
          }
          res.writeHead(200, {
            'content-type': fallbackType,
            'content-length': buf.length,
            'cache-control': 'public, max-age=86400',
          });
          res.end(buf);
        });
        return;
      }

      if (!sameOriginOk(req)) return sendJson(res, 403, { ok: false, error: 'cross-origin denied' });
      const supplied = String(req.headers?.['x-watch-history-token'] || cookieValue(req, 'wh_auth') || '');
      if (!tokenOk(supplied, AUTH_TOKEN)) {
        return sendJson(res, 401, { ok: false, error: 'unauthorized' });
      }
      if (req.method === 'POST' && !/^application\/json/i.test(String(req.headers?.['content-type'] || ''))) {
        return sendJson(res, 415, { ok: false, error: 'content-type must be application/json' });
      }
      return handler(req, res);
    },
  }), 'watch-history: /api/watch-history');

  if (ctx.tools && typeof ctx.tools.register === 'function') {
    try {
      const dispose = ctx.tools.register(defineTool({
        name: 'watch_history_add',
        description: '把一条观看记录写入历史。B 站记录缺 url/封面会自动补；不填 status 默认 metadata_only（没看）；写入后设置页刷新即可看到。',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: '平台，默认 bilibili' },
            content_id: { type: 'string', description: 'B 站 BV 号或平台内容 ID' },
            title: { type: 'string', description: '标题（必填）' },
            creator: { type: 'string', description: 'UP / 作者' },
            started_at: { type: 'string', description: 'ISO 时间，默认现在' },
            status: { type: 'string', description: 'watched / metadata_only / reference_only' },
            seen: { type: 'boolean', description: '看了/没看；不填按 status 推导' },
            view_mode: { type: 'string', description: 'full_playback/frames/subtitle/frames+subtitle/ai_review/metadata/reference' },
            one_liner: { type: 'string', description: '一句话感受' },
            tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
            cover_url: { type: 'string', description: '封面 URL，留空自动补' },
            url: { type: 'string', description: '原视频 URL，留空自动拼' },
          },
          required: ['content_id', 'title'],
          additionalProperties: true,
        },
        async execute(args) {
          const saved = await addRecord(args || {}, file, runtimeConfig);
          return { ok: true, data: saved };
        },
      }));
      ctx.effect(() => dispose, 'watch-history: tool');
    } catch (e) {
      console.error('[watch-history] tool register failed:', e?.message || e);
    }
  }
}
