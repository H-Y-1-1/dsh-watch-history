import { fetchJson, isHttpUrl } from './http.mjs';

const MEDIA = new Set(['video', 'post', 'thread', 'repo']);

function clean(data) {
  const d = data && data.data && typeof data.data === 'object' ? data.data : data;
  if (!d || typeof d !== 'object' || d.ok === false) return {};
  const out = {};
  for (const k of ['title', 'creator', 'one_liner']) {
    if (typeof d[k] === 'string' && d[k].trim()) out[k] = d[k].trim();
  }
  if (typeof d.cover_url === 'string' && isHttpUrl(d.cover_url)) out.cover_url = d.cover_url;
  if (typeof d.media_type === 'string' && MEDIA.has(d.media_type)) out.media_type = d.media_type;
  return out;
}

export async function providerEnrich(record, config = {}) {
  const p = config.provider;
  if (!p || !isHttpUrl(p.url)) return {};
  const timeout = Math.max(500, Math.min(Number(p.timeout_ms) || 3000, 10000));
  try {
    const data = await fetchJson(p.url, {
      method: 'POST',
      timeout,
      headers: {
        'content-type': 'application/json',
        ...(p.headers && typeof p.headers === 'object' ? p.headers : {}),
      },
      body: JSON.stringify({
        schema_version: 1,
        platform: record.platform || '',
        url: record.url || '',
        content_id: record.content_id || '',
      }),
    });
    return clean(data);
  } catch {
    return {};
  }
}
