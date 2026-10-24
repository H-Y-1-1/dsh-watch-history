import { fetchJson, isHttpUrl } from './http.mjs';

const MEDIA = new Set(['video', 'post', 'thread', 'repo']);

function getPath(obj, path) {
  let cur = obj;
  for (const part of String(path || '').split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function clean(data, adapter) {
  const out = {};
  for (const [key, path] of Object.entries(adapter.fields || {})) {
    const value = getPath(data, path);
    if (value == null || value === '') continue;
    if (key === 'cover_url') {
      if (typeof value === 'string' && isHttpUrl(value)) out.cover_url = value;
    } else if (key === 'media_type') {
      if (typeof value === 'string' && MEDIA.has(value)) out.media_type = value;
    } else if (['title', 'creator', 'one_liner'].includes(key) && typeof value === 'string') {
      out[key] = value.trim();
    }
  }
  if (!out.media_type && adapter.media_type && MEDIA.has(adapter.media_type)) out.media_type = adapter.media_type;
  return out;
}

export async function declarativeEnrich(record, config = {}) {
  const adapters = Array.isArray(config.adapters) ? config.adapters : [];
  for (const a of adapters) {
    if (!a || !a.url_pattern || typeof a.api !== 'string' || !a.api) continue;
    if (a.platform && record.platform && a.platform !== record.platform) continue;
    let re;
    try {
      re = new RegExp(String(a.url_pattern), 'i');
    } catch {
      continue;
    }
    const m = String(record.url || '').match(re);
    if (!m) continue;
    if (!isHttpUrl(a.api.replace(/\{id\}/g, 'x'))) continue;
    const id = m[1] || m[0];
    const api = String(a.api).replace(/\{id\}/g, encodeURIComponent(id));
    try {
      const data = await fetchJson(api, {
        timeout: Math.max(500, Math.min(Number(a.timeout_ms) || 4000, 10000)),
        headers: a.headers && typeof a.headers === 'object' ? a.headers : {},
      });
      const extra = clean(data, a);
      if (Object.keys(extra).length) return extra;
    } catch {
      // 这条配置失败就继续下一条
    }
  }
  return {};
}
