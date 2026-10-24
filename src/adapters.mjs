const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

const PLATFORMS = [
  { name: 'xiaohongshu', re: /^https?:\/\/(?:www\.)?xiaohongshu\.com\/explore\/([^/?#]+)/i },
  { name: 'douyin', re: /^https?:\/\/(?:www\.)?douyin\.com\/[^#]*[?&]modal_id=(\d+)/i },
  { name: 'xiaoheihe', re: /^https?:\/\/(?:www\.)?xiaoheihe\.cn\/app\/bbs\/link\/(\d+)/i },
  { name: 'tieba', re: /^https?:\/\/tieba\.baidu\.com\/p\/(\d+)/i },
  { name: 'kuaishou', re: /^https?:\/\/(?:www\.)?kuaishou\.com\/short-video\/([^/?#]+)/i },
  { name: 'github', re: /^https?:\/\/github\.com\/([^/?#]+\/[^/?#]+)/i },
];

const MEDIA = {
  bilibili: 'video',
  douyin: 'video',
  kuaishou: 'video',
  youtube: 'video',
  xiaohongshu: 'post',
  xiaoheihe: 'post',
  tieba: 'thread',
  github: 'repo',
  weibo: 'post',
  zhihu: 'post',
};

const LABEL = {
  bilibili: 'B站',
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  xiaoheihe: '小黑盒',
  tieba: '贴吧',
  github: 'GitHub',
};

const BAD_TITLES = [
  '小红书 - 你的生活兴趣社区',
  '百度安全验证',
  '短视频-快手',
  '小黑盒 - 玩家高能聚集地',
];

export function parseUrl(value = '') {
  for (const p of PLATFORMS) {
    const m = String(value).match(p.re);
    if (m) {
      let id = m[1];
      if (p.name === 'github') id = id.replace(/\.git$/i, '');
      return { platform: p.name, content_id: id };
    }
  }
  return null;
}

export function platformLabel(p) {
  return LABEL[p] || p || '其他';
}

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function meta(html, prop) {
  const re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + prop + '["\\\'][^>]*content=["\\\']([^"\\\']*)', 'i');
  const m = String(html).match(re);
  return m ? decode(m[1]) : '';
}

function pageTitle(html) {
  const m = String(html).match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decode(m[1]).trim() : '';
}

async function fetchWithTimeout(url, { timeout = 5000, ...opts } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctl.signal,
      headers: {
        'user-agent': UA,
        'accept-language': 'zh-CN,zh;q=0.9',
        ...(opts.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function pageMeta(url) {
  try {
    const res = await fetchWithTimeout(url, { redirect: 'follow' });
    const html = await res.text();
    return {
      title: meta(html, 'og:title') || pageTitle(html),
      image: meta(html, 'og:image'),
      description: meta(html, 'og:description') || meta(html, 'description'),
      finalUrl: res.url,
    };
  } catch {
    return { title: '', image: '', description: '', finalUrl: '' };
  }
}

async function githubMeta(id) {
  try {
    const res = await fetchWithTimeout('https://api.github.com/repos/' + id, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      title: j.full_name || id,
      creator: j.owner?.login || id.split('/')[0],
      image: j.owner?.avatar_url || '',
      description: j.description || '',
    };
  } catch {
    return null;
  }
}

export async function enrichRecord(record) {
  const r = { ...record };
  const parsed = parseUrl(r.url || '');
  if (parsed) {
    if (!r.platform) r.platform = parsed.platform;
    if (!r.content_id) r.content_id = parsed.content_id;
  }
  if (!r.media_type && MEDIA[r.platform]) r.media_type = MEDIA[r.platform];

  if (r.platform === 'github' && r.content_id) {
    const gh = await githubMeta(r.content_id);
    if (gh) {
      r.title = r.title || gh.title;
      r.creator = r.creator || gh.creator;
      r.cover_url = r.cover_url || gh.image;
      r.one_liner = r.one_liner || gh.description;
    }
  } else if (r.url && r.platform !== 'bilibili' && ['xiaohongshu', 'douyin', 'xiaoheihe', 'tieba', 'kuaishou'].includes(r.platform)) {
    const m = await pageMeta(r.url);
    const blocked = /login|passport|security|captcha/i.test(m.finalUrl || '') || BAD_TITLES.includes(m.title);
    if (!blocked) {
      if (m.title && !/安全验证|登录/.test(m.title)) r.title = r.title || m.title;
      if (m.image && !r.cover_url) {
        r.cover_url = m.image.startsWith('//') ? 'https:' + m.image : m.image;
      }
      if (m.description && !r.one_liner) r.one_liner = m.description.slice(0, 120);
    }
  }

  return r;
}