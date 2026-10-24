import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { append, query, readAll, stats } from '../src/store.mjs';
import { createHandler } from '../src/server.mjs';

const dir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-wh-'));
const file = path.join(dir, 'history.jsonl');

const a = append({
  platform: 'bilibili', content_id: 'BV1test00001', title: '测试视频 A',
  started_at: '2026-10-23T19:00:00+08:00', status: 'watched', progress: 0.5,
  tags: ['测试'],
}, file);

const b = append({
  platform: 'bilibili', content_id: 'BV1test00002', title: '测试视频 B',
  started_at: '2026-10-23T20:00:00+08:00', status: 'metadata_only',
}, file);

assert.equal(a.id, 'bilibili:BV1test00001');
assert.equal(readAll(file).length, 2);
assert.equal(query({ status: 'watched' }, file).total, 1);
assert.equal(query({ q: '视频 B' }, file).total, 1);
assert.equal(stats(file).count, 2);
assert.throws(() => append({ platform: 'bilibili' }, file), /missing\/invalid/);

const handler = createHandler({ file });
let captured = null;
const res = {
  writeHead(code, headers) { captured = { code, headers }; },
  end(text) { captured.body = JSON.parse(text); },
};
await handler({ method: 'GET', url: '/api/watch-history?limit=10' }, res);
assert.equal(captured.code, 200);
assert.equal(captured.body.data.total, 2);

const postBody = JSON.stringify({
  content_id: 'BV1test00003',
  title: '测试视频 C',
  started_at: '2026-10-23T21:00:00+08:00',
  cover_url: 'https://example.com/c.jpg',
});
const postReq = Readable.from([Buffer.from(postBody)]);
postReq.method = 'POST';
postReq.url = '/api/watch-history';
await handler(postReq, res);
assert.equal(captured.code, 201);
assert.equal(captured.body.ok, true);
assert.equal(captured.body.data.url, 'https://www.bilibili.com/video/BV1test00003');
assert.equal(captured.body.data.seen, false);
assert.equal(captured.body.data.view_mode, 'metadata');
assert.equal(readAll(file).length, 3);

fs.rmSync(dir, { recursive: true, force: true });
console.log('watch-history store/server ok');
