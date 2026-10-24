import { append } from './store.mjs';
import { resolveRecord } from './resolve.mjs';
import { parseUrl } from './adapters.mjs';

export async function prepareRecord(record, config) {
  if (!record || typeof record !== 'object') throw new Error('record must be an object');
  let r = { ...record };

  const parsed = parseUrl(r.url || '');
  if (parsed) {
    if (!r.platform) r.platform = parsed.platform;
    if (!r.content_id) r.content_id = parsed.content_id;
  }
  if (!r.platform && r.content_id && /^BV/i.test(r.content_id)) r.platform = 'bilibili';
  if (!r.started_at) r.started_at = new Date().toISOString();
  if (!r.status) r.status = 'metadata_only';
  if (!r.source_agent) r.source_agent = 'plugin';

  r = await resolveRecord(r, config);
  if (!r.media_type) r.media_type = 'post';

  const statusMode = { watched: 'ai_review', metadata_only: 'metadata', reference_only: 'reference' };
  if (!r.view_mode) r.view_mode = statusMode[r.status] || 'metadata';
  if (r.seen == null) r.seen = r.view_mode === 'full_playback' || r.status === 'watched';
  if (r.completed == null) r.completed = false;

  if (r.platform === 'bilibili' && r.content_id) {
    if (!r.url) r.url = 'https://www.bilibili.com/video/' + r.content_id;
    if (!r.cover_url) {
      try {
        const j = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + r.content_id, {
          headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://www.bilibili.com/' },
          signal: AbortSignal.timeout(5000),
        }).then((x) => x.json());
        if (j.code === 0 && j.data) {
          if (!r.cover_url && j.data.pic) r.cover_url = j.data.pic.replace('http://', 'https://');
          if (j.data.title && (!r.title || /^B站 · /.test(r.title))) r.title = j.data.title;
          if (!r.creator && j.data.owner?.name) r.creator = j.data.owner.name;
          if (!r.duration_sec && j.data.duration) r.duration_sec = j.data.duration;
        }
      } catch {
        // 封面不是必需字段
      }
    }
  }

  return r;
}

export async function addRecord(record, file, config) {
  return append(await prepareRecord(record, config), file);
}
