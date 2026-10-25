import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.mjs';

const dir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-wh-'));
const file = path.join(dir, 'config.json');
try {
  fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ dataFile: 'x.jsonl' }), 'utf8');
  assert.equal(loadConfig(file).dataFile, 'x.jsonl');
  fs.writeFileSync(file, JSON.stringify({ dataFile: 'y.jsonl' }), 'utf8');
  assert.equal(loadConfig(file).dataFile, 'y.jsonl');
  fs.writeFileSync(file, '{bad', 'utf8');
  assert.deepEqual(loadConfig(file), {});
  assert.deepEqual(loadConfig(path.join(dir, 'missing.json')), {});
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('watch-history config ok');
