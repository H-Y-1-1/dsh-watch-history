import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(HERE, '..', 'config.json');

export function configFile(env = process.env) {
  return env.WATCH_HISTORY_CONFIG || DEFAULT_FILE;
}

export function loadConfig(file = configFile()) {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
}
