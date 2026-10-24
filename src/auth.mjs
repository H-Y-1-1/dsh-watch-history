import crypto from 'node:crypto';

const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

export function sameOriginOk(req) {
  try {
    const host = String(req.headers?.host || '');
    if (!host) return false;
    if (!LOOPBACK.test(host)) return false;

    const pick = String(req.headers?.origin || req.headers?.referer || '');
    if (pick) {
      const u = new URL(pick);
      if (!/^(127\.0\.0\.1|localhost|\[::1\])$/i.test(u.hostname)) return false;
    }

    const site = String(req.headers?.['sec-fetch-site'] || '');
    if (site && site !== 'same-origin' && site !== 'none') return false;
    return true;
  } catch {
    return false;
  }
}

export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function cookieValue(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

export function tokenOk(value, expected) {
  const a = Buffer.from(String(value || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

export function authCookie(token) {
  return `wh_auth=${token}; Path=/api/watch-history; HttpOnly; SameSite=Strict; Max-Age=86400`;
}

export function sendJson(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(text);
}
