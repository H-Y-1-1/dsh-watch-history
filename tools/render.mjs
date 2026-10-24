import fs from 'node:fs';
import path from 'node:path';

const root = process.env.WATCH_HISTORY_ROOT || process.cwd();
const histFile = path.join(root, 'memory', 'history.jsonl');
const outDir = path.join(root, 'out');
const outHtml = path.join(outDir, 'history.html');
const outJson = path.join(outDir, 'history.json');

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

const items = readJsonl(histFile)
  .map((x) => ({
    platform: x.platform || 'unknown',
    content_id: x.content_id || x.id || '',
    url: x.url || (x.platform === 'bilibili' && x.content_id ? 'https://www.bilibili.com/video/' + x.content_id : ''),
    cover_url: x.cover_url || '',
    title: x.title || '(无标题)',
    creator: x.creator || '',
    started_at: x.started_at || '',
    date: x.started_at ? new Date(x.started_at).toLocaleDateString('sv-SE') : '',
    progress: typeof x.progress === 'number' ? x.progress : 0,
    completed: Boolean(x.completed),
    rating: x.rating ?? null,
    mood: x.mood || '',
    one_liner: x.one_liner || '',
    tags: Array.isArray(x.tags) ? x.tags : [],
    status: x.status || '',
  }))
  .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

fs.mkdirSync(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
fs.writeFileSync(outJson, JSON.stringify({ generated_at: generatedAt, count: items.length, items }, null, 2), 'utf8');

const data = JSON.stringify(items).replace(/</g, '\\u003c');
const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>观看历史</title>
<style>
  :root { color-scheme: dark; --bg:#0f1216; --card:#171c22; --line:#2a323c; --fg:#e7edf4; --dim:#8b98a8; --acc:#6fb3ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; }
  header { padding:28px 24px 12px; max-width:1100px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 6px; }
  .sub { color:var(--dim); font-size:13px; }
  .live { display:inline-block; width:7px; height:7px; border-radius:50%; background:#4ade80; margin-right:6px; vertical-align:middle; }
  .stats { display:flex; gap:18px; margin:16px 0 4px; flex-wrap:wrap; }
  .stat b { font-size:18px; color:var(--acc); }
  .bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:18px auto 8px; max-width:1100px; padding:0 24px; }
  .chip { border:1px solid var(--line); background:var(--card); color:var(--fg); padding:6px 12px; border-radius:999px; cursor:pointer; font-size:13px; }
  .chip.on { border-color:var(--acc); color:var(--acc); }
  input[type=search] { margin-left:auto; background:var(--card); border:1px solid var(--line); color:var(--fg); border-radius:10px; padding:8px 12px; min-width:220px; }
  main { max-width:1100px; margin:0 auto; padding:16px 24px 48px; display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:0; overflow:hidden; display:flex; flex-direction:column; gap:8px; min-height:170px; }
  .cover { height:120px; background:linear-gradient(135deg,#1b2a3a,#0f1216); flex:0 0 auto; }
  .cover img { width:100%; height:100%; object-fit:cover; display:block; }
  .card > h2 { margin:0 16px; }
  .card > .meta { margin:0 16px; }
  .card > .one { margin:0 16px; }
  .card > .prog { margin:0 16px; }
  .card > .tags { margin:auto 16px 0; }
  .actions { display:flex; gap:10px; align-items:center; margin:0 16px 14px; }
  .card h2 { font-size:15px; margin:0; line-height:1.4; }
  .meta { color:var(--dim); font-size:12px; display:flex; gap:8px; flex-wrap:wrap; }
  .badge { border:1px solid var(--line); border-radius:999px; padding:1px 8px; font-size:11px; color:var(--dim); }
  .badge.bili { color:#ff8fb1; border-color:#5a2a3a; }
  .one { color:#c8d3df; font-size:13px; }
  .tags { display:flex; gap:6px; flex-wrap:wrap; margin-top:auto; }
  .tag { font-size:11px; color:var(--dim); background:#11161c; border:1px solid var(--line); border-radius:6px; padding:1px 6px; }
  .prog { height:4px; background:#11161c; border-radius:4px; overflow:hidden; }
  .prog i { display:block; height:100%; background:var(--acc); }
  a { color:var(--acc); text-decoration:none; font-size:12px; }
  .empty { grid-column:1/-1; color:var(--dim); text-align:center; padding:48px 0; }
</style>
</head>
<body>
<header>
  <h1>观看历史</h1>
  <div class="sub"><span class="live"></span><span id="meta"></span> · 数据在 <code>memory/history.jsonl</code></div>
  <div class="stats" id="stats"></div>
</header>
<div class="bar">
  <button class="chip on" data-f="all">全部</button>
  <button class="chip" data-f="bilibili">B站</button>
  <button class="chip" data-f="done">看完</button>
  <button class="chip" data-f="undone">没看完</button>
  <input id="q" type="search" placeholder="搜标题 / UP / 标签">
</div>
<main id="grid"></main>
<script>
let ITEMS = ${data};
let lastGen = ${JSON.stringify(generatedAt)};
let filter = 'all', q = '';
const stats = document.getElementById('stats');
const grid = document.getElementById('grid');
function render() {
  const list = ITEMS.filter(x => {
    if (filter === 'bilibili' && x.platform !== 'bilibili') return false;
    if (filter === 'done' && !x.completed) return false;
    if (filter === 'undone' && x.completed) return false;
    if (q) {
      const hay = (x.title + ' ' + x.creator + ' ' + x.tags.join(' ')).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const done = ITEMS.filter(x => x.completed).length;
  const plats = [...new Set(ITEMS.map(x => x.platform))];
  stats.innerHTML = '<div class="stat"><b>' + ITEMS.length + '</b> 条记录</div>' +
    '<div class="stat"><b>' + done + '</b> 看完</div>' +
    '<div class="stat"><b>' + plats.length + '</b> 个平台</div>';
  const isHttp = location.protocol === 'http:';
  document.getElementById('meta').textContent =
    (isHttp ? '数据变了自动更新' : '本地文件：手动刷新（用 serve.mjs 可自动更新）') +
    ' · 生成于 ' + new Date(lastGen).toLocaleTimeString('zh-CN', { hour12: false }) +
    ' · ' + ITEMS.length + ' 条';
  grid.innerHTML = list.length ? list.map(x => {
    const cover = safeUrl(x.cover_url);
    const link = safeUrl(x.url);
    const tags = Array.isArray(x.tags) ? x.tags : [];
    return '<article class="card">' +
      '<div class="cover">' + (cover ? '<img src="' + escapeHtml(cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</div>' +
      '<div class="meta"><span class="badge ' + (x.platform === 'bilibili' ? 'bili' : '') + '">' + escapeHtml(x.platform || '') + '</span>' +
      '<span>' + escapeHtml(x.date || '') + '</span>' +
      (x.rating ? '<span>★ ' + escapeHtml(x.rating) + '</span>' : '') + '</div>' +
      '<h2>' + escapeHtml(x.title) + '</h2>' +
      '<div class="meta"><span>' + escapeHtml(x.creator || '') + '</span>' + (x.status ? '<span>· ' + escapeHtml(x.status) + '</span>' : '') + '</div>' +
      (x.one_liner ? '<div class="one">' + escapeHtml(x.one_liner) + '</div>' : '') +
      '<div class="tags">' + tags.map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('') + '</div>' +
      (link ? '<div class="actions"><a href="' + escapeHtml(link) + '" target="_blank" rel="noreferrer">打开原视频</a></div>' : '') +
      '</article>';
  }).join('') : '<div class="empty">还没有记录。跑一轮之后，AI 会往 memory/history.jsonl 里写。</div>';
}
function safeUrl(value) {
  try {
    const u = new URL(String(value || ''), location.href);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch {
    return '';
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); filter = btn.dataset.f; render();
}));
document.getElementById('q').addEventListener('input', (e) => { q = e.target.value; render(); });
if (location.protocol === 'http:' && window.EventSource) {
  const es = new EventSource('/events');
  es.onmessage = async () => {
    try {
      const r = await fetch('history.json?t=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.generated_at && j.generated_at !== lastGen) {
        lastGen = j.generated_at;
        ITEMS = j.items;
        render();
      }
    } catch { /* 忽略：下一次事件再试 */ }
  };
}
render();
</script>
</body>
</html>
`;

fs.writeFileSync(outHtml, html, 'utf8');
console.log(JSON.stringify({ ok: true, html: outHtml, json: outJson, count: items.length }));
