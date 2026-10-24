const MAX_BYTES = 1024 * 1024;

export function isHttpUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function fetchJson(url, { timeout = 4000, method = 'GET', headers = {}, body } = {}) {
  if (!isHttpUrl(url)) throw new Error('only http(s) allowed');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: ctl.signal,
      headers: {
        'user-agent': 'dsh-watch-history/0.1',
        ...headers,
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) {
      ctl.abort();
      throw new Error('response too large');
    }
    if (!res.body) throw new Error('empty response');
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        ctl.abort();
        throw new Error('response too large');
      }
      chunks.push(Buffer.from(value));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
