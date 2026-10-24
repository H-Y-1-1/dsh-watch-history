import assert from 'node:assert/strict';
import http from 'node:http';
import { resolveRecord } from '../src/resolve.mjs';

const server = http.createServer((req, res) => {
  if (req.url === '/provider') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        schema_version: 1,
        title: 'Provider 标题',
        creator: 'Provider 作者',
        cover_url: 'https://example.com/provider.jpg',
        media_type: 'video',
      }));
    });
    return;
  }
  if (req.url === '/api/foo/123') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: { title: 'Foo API 标题', cover: { url: 'https://example.com/foo.jpg' } } }));
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

const providerConfig = {
  provider: { url: base + '/provider', timeout_ms: 2000 },
};
const providerOut = await resolveRecord({
  platform: 'bar', content_id: '1', url: 'https://bar.example/v/1', started_at: '2026-10-24T18:00:00+08:00', title: '',
}, providerConfig);
assert.equal(providerOut.title, 'Provider 标题');
assert.equal(providerOut.cover_url, 'https://example.com/provider.jpg');
assert.equal(providerOut.media_type, 'video');

const configConfig = {
  adapters: [{
    platform: 'foo',
    url_pattern: 'foo\\.com/v/(\\d+)',
    api: base + '/api/foo/{id}',
    media_type: 'video',
    fields: { title: 'data.title', cover_url: 'data.cover.url' },
  }],
};
const configOut = await resolveRecord({
  platform: 'foo', content_id: '123', url: 'https://foo.com/v/123', started_at: '2026-10-24T18:00:00+08:00', title: '',
}, configConfig);
assert.equal(configOut.title, 'Foo API 标题');
assert.equal(configOut.cover_url, 'https://example.com/foo.jpg');
assert.equal(configOut.media_type, 'video');

const fixedOut = await resolveRecord({
  platform: 'bar', content_id: '1', url: 'https://bar.example/v/1', started_at: '2026-10-24T18:00:00+08:00',
  title: '已有的标题', cover_url: 'https://example.com/fixed.jpg',
}, providerConfig);
assert.equal(fixedOut.title, '已有的标题');
assert.equal(fixedOut.cover_url, 'https://example.com/fixed.jpg');

server.close();
console.log('watch-history resolve/provider/declarative ok');

