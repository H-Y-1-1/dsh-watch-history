import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sameOriginOk, tokenOk, cookieValue } from '../src/auth.mjs';
import { apply } from '../index.js';

assert.equal(sameOriginOk({ headers: { host: '127.0.0.1:1234', origin: 'http://127.0.0.1:1234' } }), true);
assert.equal(sameOriginOk({ headers: { host: '127.0.0.1:1234', origin: 'http://evil.example' } }), false);
assert.equal(sameOriginOk({ headers: { host: 'evil.example', origin: 'http://evil.example' } }), false);
assert.equal(sameOriginOk({ headers: { host: '127.0.0.1:1234', 'sec-fetch-site': 'cross-site' } }), false);
assert.equal(sameOriginOk({ headers: {} }), false);
assert.equal(cookieValue({ headers: { cookie: 'wh_auth=%' } }, 'wh_auth'), '');
assert.equal(tokenOk('abc', 'abc'), true);
assert.equal(tokenOk('abc', 'abd'), false);

const dir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-auth-'));
const file = path.join(dir, 'history.jsonl');
fs.writeFileSync(file, '', 'utf8');

let route = null;
const ctx = {
  effect: (fn) => fn(),
  webServer: { register: (o) => { route = o; return () => {}; } },
  tools: { register: () => () => {} },
};
apply(ctx, { dataFile: file });

const call = async (method, url, headers = {}) => {
  let cap = null;
  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    writeHead(code, h) { cap = { code, headers: { ...this.headers, ...(h || {}) } }; },
    end(text) { cap.body = String(text || ''); },
  };
  await route.handler({ method, url, headers }, res);
  await new Promise((r) => setTimeout(r, 20));
  return cap;
};

const cross = await call('GET', '/api/watch-history/bootstrap', { host: '127.0.0.1:1234', origin: 'http://evil.example' });
assert.equal(cross.code, 403);

const boot = await call('GET', '/api/watch-history/bootstrap', { host: '127.0.0.1:1234', origin: 'http://127.0.0.1:1234' });
assert.equal(boot.code, 200);
assert.match(boot.headers['set-cookie'], /wh_auth=/);
const cookie = String(boot.headers['set-cookie']).match(/wh_auth=([^;]+)/)[1];
const token = JSON.parse(boot.body).token;
assert.ok(token);

const withHeader = await call('GET', '/api/watch-history', {
  host: '127.0.0.1:1234',
  origin: 'http://127.0.0.1:1234',
  'x-watch-history-token': token,
});
assert.equal(withHeader.code, 200);

const noCookie = await call('GET', '/api/watch-history', { host: '127.0.0.1:1234', origin: 'http://127.0.0.1:1234' });
assert.equal(noCookie.code, 401);

const withCookie = await call('GET', '/api/watch-history', {
  host: '127.0.0.1:1234',
  origin: 'http://127.0.0.1:1234',
  cookie: 'wh_auth=' + cookie,
});
assert.equal(withCookie.code, 200);
assert.equal(JSON.parse(withCookie.body).data.total, 0);

fs.rmSync(dir, { recursive: true, force: true });
console.log('watch-history auth ok');
