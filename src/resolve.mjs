import { enrichRecord, platformLabel } from './adapters.mjs';
import { loadConfig } from './config.mjs';
import { providerEnrich } from './provider.mjs';
import { declarativeEnrich } from './declarative.mjs';

function fillMissing(record, extra) {
  for (const [k, v] of Object.entries(extra || {})) {
    if (record[k] == null || record[k] === '') record[k] = v;
  }
}

export async function resolveRecord(record, config = loadConfig()) {
  let r = await enrichRecord({ ...record });

  // 记录自带字段优先；内置适配器之后，才让目标环境的 Provider/配置补缺。
  // B站封面由 add.mjs 的公开 view API 负责，不走 Provider/配置。
  if (r.platform !== 'bilibili') {
    if (!r.title || !r.cover_url) fillMissing(r, await providerEnrich(r, config));
    if (!r.title || !r.cover_url) fillMissing(r, await declarativeEnrich(r, config));
  }
  if (!r.title) r.title = platformLabel(r.platform) + ' · ' + (r.content_id || '未命名');
  return r;
}
