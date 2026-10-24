window.__ModuleLoader__.load({
  id: 'dsh-watch-history',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useState } = React

    const API = '/api/watch-history'
    const FALLBACK = '/api/watch-history/fallback'

    const CSS = `
.wh-page{display:flex;flex-direction:column;gap:14px;padding:4px 2px 14px;}
.wh-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.wh-title{font-size:16px;font-weight:600;}
.wh-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b98a8);}
.wh-chip{border:1px solid var(--dsw-alias-bg-layer-3,rgba(128,128,128,.22));background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.10));color:inherit;border-radius:999px;padding:5px 11px;font-size:12px;cursor:pointer;font-family:inherit;}
.wh-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.22));}
.wh-chip.on{border-color:#3b82f6;color:#3b82f6;}
.wh-chip[disabled]{opacity:.5;cursor:default;}
.wh-input{flex:1;min-width:180px;box-sizing:border-box;padding:7px 10px;border-radius:9px;font-size:12px;border:1px solid var(--dsw-alias-bg-layer-3,rgba(128,128,128,.22));background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.10));color:inherit;font-family:inherit;}
.wh-input:focus{outline:none;border-color:#3b82f6;}
.wh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
.wh-card{border:1px solid var(--dsw-alias-bg-layer-3,rgba(128,128,128,.22));border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.06));display:flex;flex-direction:column;}
.wh-cover{height:112px;background:linear-gradient(135deg,#1b2a3a,#0f1216);flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.wh-cover-img{width:100%;height:100%;object-fit:cover;display:block;}
.wh-cover-img.fallback{object-fit:contain;padding:10px;background:#f4f8ff;}
.wh-body{display:flex;flex-direction:column;gap:6px;padding:10px 11px 11px;min-height:0;}
.wh-meta{display:flex;gap:7px;flex-wrap:wrap;align-items:center;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b98a8);}
.wh-badge{border:1px solid var(--dsw-alias-bg-layer-3,rgba(128,128,128,.22));border-radius:999px;padding:0 7px;font-size:10px;}
.wh-h3{font-size:13px;line-height:1.45;margin:0;font-weight:600;}
.wh-one{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#c8d3df);margin:0;}
.wh-tags{display:flex;gap:5px;flex-wrap:wrap;}
.wh-tag{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b98a8);background:var(--dsw-alias-bg-layer-4,rgba(128,128,128,.10));border:1px solid var(--dsw-alias-bg-layer-3,rgba(128,128,128,.16));border-radius:5px;padding:0 5px;}
.wh-link{font-size:11px;color:#3b82f6;text-decoration:none;margin-top:auto;}
.wh-empty{padding:36px 0;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,#8b98a8);}
.wh-err{font-size:11px;line-height:16px;padding:7px 9px;border-radius:8px;color:#f87171;background:rgba(248,113,113,.10);word-break:break-all;}
`

    function fmtDate(value) {
      if (!value) return ''
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
      return d.toLocaleDateString('sv-SE')
    }

    function safeHttpUrl(value) {
      try {
        const u = new URL(String(value || ''))
        return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : ''
      } catch {
        return ''
      }
    }

    function urlOf(x) {
      const direct = safeHttpUrl(x.url)
      if (direct) return direct
      if (x.platform === 'bilibili' && x.content_id) {
        return 'https://www.bilibili.com/video/' + encodeURIComponent(x.content_id)
      }
      return ''
    }

    function seenLabel(x) {
      return x.seen ? '看了' : '没看'
    }

    function modeLabel(x) {
      const map = {
        full_playback: '完整播放',
        frames: '抽帧',
        subtitle: '字幕',
        'frames+subtitle': '抽帧+字幕',
        ai_review: 'AI审片',
        metadata: '仅登记',
        reference: '仅参考',
      }
      return map[x.view_mode] || (x.completed ? '完整播放' : '')
    }

    function platformLabel(p) {
      const map = {
        bilibili: 'B站',
        douyin: '抖音',
        xiaoheihe: '小黑盒',
        tieba: '贴吧',
        xiaohongshu: '小红书',
        kuaishou: '快手',
        weibo: '微博',
        zhihu: '知乎',
      }
      return map[p] || p || '其他'
    }

    let authed = false
    let authToken = ''

    async function ensureAuth() {
      if (authed) return
      const res = await fetch('/api/watch-history/bootstrap', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('鉴权失败 HTTP ' + res.status)
      const body = await res.json().catch(() => ({}))
      if (!body.token) throw new Error('鉴权失败：没有 token')
      authToken = body.token
      authed = true
    }

    function Panel() {
      const [items, setItems] = useState([])
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [filter, setFilter] = useState('all')
      const [q, setQ] = useState('')

      async function load() {
        setLoading(true)
        setError('')
        try {
          await ensureAuth()
          let res = await fetch(API + '?limit=500', {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'x-watch-history-token': authToken },
          })
          if (res.status === 401) {
            authed = false
            await ensureAuth()
            res = await fetch(API + '?limit=500', {
              credentials: 'same-origin',
              cache: 'no-store',
              headers: { 'x-watch-history-token': authToken },
            })
          }
          const body = await res.json().catch(() => ({}))
          if (!res.ok || body.ok === false) {
            throw new Error(body.error || ('HTTP ' + res.status))
          }
          setItems(Array.isArray(body.data && body.data.items) ? body.data.items : [])
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
        } finally {
          setLoading(false)
        }
      }

      useEffect(() => { load() }, [])

      const list = useMemo(() => {
        const needle = q.trim().toLowerCase()
        return items.filter((x) => {
          if (filter.startsWith('platform:') && x.platform !== filter.slice('platform:'.length)) return false
          if (filter === 'seen' && !x.seen) return false
          if (filter === 'unseen' && x.seen) return false
          if (needle) {
            const hay = [x.title, x.creator, x.one_liner, (Array.isArray(x.tags) ? x.tags : []).join(' ')]
              .join(' ').toLowerCase()
            if (!hay.includes(needle)) return false
          }
          return true
        })
      }, [items, filter, q])

      const seen = items.filter((x) => x.seen).length
      const platforms = [...new Set(items.map((x) => x.platform).filter(Boolean))]

      const chip = (id, label) => h('button', {
        type: 'button',
        className: 'wh-chip' + (filter === id ? ' on' : ''),
        onClick: () => setFilter(id),
      }, label)

      return h('div', { className: 'wh-page' },
        h('style', null, CSS),
        h('div', { className: 'wh-head' },
          h('div', { className: 'wh-title' }, '观看历史'),
          h('button', { type: 'button', className: 'wh-chip', onClick: load, disabled: loading }, loading ? '加载中…' : '刷新'),
          h('div', { className: 'wh-sub' }, items.length + ' 条 · 看了 ' + seen + ' · 没看 ' + (items.length - seen) + ' · ' + platforms.length + ' 个平台'),
        ),
        h('div', { className: 'wh-head' },
          chip('all', '全部'),
          ...platforms.map((p) => chip('platform:' + p, platformLabel(p))),
          chip('seen', '看了'),
          chip('unseen', '没看'),
          h('input', {
            className: 'wh-input',
            placeholder: '搜标题 / UP / 标签',
            value: q,
            onChange: (e) => setQ(e.target.value),
          }),
        ),
        error ? h('div', { className: 'wh-err' }, '读取失败：' + error + '（未登录/无权限时先重新打开 DSH）') : null,
        loading ? h('div', { className: 'wh-empty' }, '加载中…') : null,
        !loading && !list.length ? h('div', { className: 'wh-empty' }, items.length ? '没有匹配记录。' : '还没有记录。') : null,
        h('div', { className: 'wh-grid' }, list.map((x, i) => {
          const url = urlOf(x)
          const cover = safeHttpUrl(x.cover_url)
          const isFallback = !cover
          const tags = Array.isArray(x.tags) ? x.tags : []
          const key = (x.id || x.content_id || (x.title || '') + '|' + (x.started_at || '')) + ':' + i
          return h('article', { key, className: 'wh-card' },
            h('div', { className: 'wh-cover' },
              h('img', {
                className: 'wh-cover-img' + (isFallback ? ' fallback' : ''),
                src: cover || FALLBACK,
                alt: '',
                loading: 'lazy',
                referrerPolicy: 'no-referrer',
                onError: (e) => {
                  const img = e.currentTarget
                  if (img.dataset.fallback) return
                  img.dataset.fallback = '1'
                  img.className = 'wh-cover-img fallback'
                  img.src = FALLBACK
                },
              }),
            ),
            h('div', { className: 'wh-body' },
              h('div', { className: 'wh-meta' },
                h('span', { className: 'wh-badge' }, platformLabel(x.platform)),
                h('span', null, fmtDate(x.started_at || x.date)),
                h('span', null, seenLabel(x)),
                modeLabel(x) ? h('span', null, modeLabel(x)) : null,
              ),
              h('h3', { className: 'wh-h3' }, x.title || '(无标题)'),
              x.creator ? h('div', { className: 'wh-meta' }, h('span', null, x.creator)) : null,
              x.one_liner ? h('p', { className: 'wh-one' }, x.one_liner) : null,
              tags.length ? h('div', { className: 'wh-tags' }, tags.map((t) => h('span', { key: t, className: 'wh-tag' }, t))) : null,
              url ? h('a', { className: 'wh-link', href: url, target: '_blank', rel: 'noreferrer' }, '打开原视频') : null,
            ),
          )
        })),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        try {
          slots.inject('settings.section', () => slots.register({
            name: 'settings.section',
            id: 'watch-history',
            order: 40,
            label: '观看历史',
          }, () => h(Panel)))
        } catch (e) {
          // 没有 settings.section 插槽时静默跳过
        }
      },
    }
  },
})
