# dsh-watch-history

> 版本：0.1.1 · [Changelog](CHANGELOG.md)

跨平台观看历史 DSH 插件：把「看过什么」存成统一记录，并在设置页用卡片墙展示。

> **三条先看**
>
> - 它是**账本 + 展示层**，不是爬虫：不会主动发现新视频，未写入 = 没有记录。
> - 默认数据在 `~/.dsh/watch-history/history.jsonl`；**装完是空历史，这是正常的**。
> - 桌面版必须在 **Settings → Plugins** 里安装/卸载；`dsh plugin --profile desktop add` 会被拒绝（desktop profile 由 Electron 独占管理）。

## 截图

![观看历史设置页](docs/screenshots/settings.png)

![平台筛选与搜索](docs/screenshots/search.png)

## 它做什么

- **统一记录**：不同平台的「看过什么」写进同一份 JSONL
- **卡片墙**：封面、标题、UP/作者、标签、平台、看了/没看、观看方式
- **筛选与搜索**：按平台、看了/没看过滤，按标题/UP/标签搜索
- **任意平台**：`platform` 只是字符串，不要求插件提前支持
- **元数据补全**：B站/GitHub 用公开接口补标题、作者、封面；其他平台走 Provider / 声明式 API
- **两种写入方式**：AI 工具 `watch_history_add`，或带 token 的 HTTP API
- **本地鉴权**：同源校验 + 32 字节随机 token，token 只在本机内存/HttpOnly cookie 里
- **不碰账号**：不抓平台、不保存 cookie、不需要登录 B站

## 它不做什么

- 不主动刷推荐、不监控浏览器、不发现新视频
- 不保存 B站 cookie / SESSDATA
- 不做评论、点赞、投币、私信
- 不去重：同一条记录调用两次，会 append 两次（需要去重请自己控制调用）

写入由调用方负责，典型是环境 Agent：

```text
Agent 看完 / 学完
→ 调 watch_history_add（或 POST /api/watch-history）
→ 写 history.jsonl
→ 设置页出现卡片
```

## 安装

### 桌面版：插件管理器

DSH → **Settings → Plugins → Add plugin**，填：

```text
https://github.com/H-Y-1-1/dsh-watch-history
```

装完**重启一次 DSH**，然后打开 **设置 → 观看历史**。

> ⚠️ 不要用 `dsh plugin --profile desktop add ...`。desktop profile 是 App 独占管理的，CLI 会报：
> `profile "desktop" is managed exclusively by the Electron application`。

### 本地开发

```bash
# 把插件目录 link 进 profile 后重启 DSH
node tools/render.mjs   # 生成静态页（可选）
```

## 首次使用

1. 装插件 → 重启 → 打开「观看历史」；
2. 默认是空历史（数据目录 `~/.dsh/watch-history/history.jsonl`）；
3. 用 `watch_history_add` 写一条测试记录；
4. 刷新设置页，确认卡片出现。

如果你已经有自己的 JSONL，在 `config.json` 里把 `dataFile` 指过去：

```json
{
  "dataFile": "D:/path/to/history.jsonl"
}
```

## 配置

复制 `config.example.json` 为 `config.json`（**不要提交到仓库**）：

```json
{
  "dataFile": "",
  "fallbackImage": "",
  "provider": {
    "url": "",
    "timeout_ms": 3000,
    "headers": {}
  },
  "adapters": []
}
```

| 字段 | 说明 |
|---|---|
| `dataFile` | 历史 JSONL 路径；空则 `~/.dsh/watch-history/history.jsonl` |
| `fallbackImage` | 可选的本地兜底图；空则用 `assets/fallback.svg` |
| `provider` | POST `resolveMedia` 的外部元数据服务，见 [CONTRACT.md](CONTRACT.md) |
| `adapters` | 声明式 URL 正则 + API 模板，见 [CONTRACT.md](CONTRACT.md) |

> 0.1.1 起兼容带 UTF-8 BOM 的 `config.json`；0.1.0 会静默忽略整份配置。

## 写入一条记录

### AI 工具

```text
watch_history_add
  platform: bilibili
  content_id: BV1xx...
  title: 标题
  started_at: 2026-10-25T12:00:00+08:00
  status: watched        # watched / metadata_only / reference_only
  seen: true             # 不填按 status 推导
  view_mode: subtitle    # full_playback / frames / subtitle / ai_review / metadata / reference
  one_liner: 一句话感受
  tags: ["游戏", "整活"]
```

B站记录缺 `url` / `cover_url` 时，插件会用公开 view API 补；其他平台可以直接传 `cover_url`。

### HTTP

```text
GET  /api/watch-history/bootstrap        → token + HttpOnly cookie
GET  /api/watch-history?limit=&offset=   → 需要 token/cookie
POST /api/watch-history                  → 需要 token/cookie + application/json
GET  /api/watch-history/fallback         → 通用占位图
```

```bash
# 先拿 token
curl http://127.0.0.1:<port>/api/watch-history/bootstrap

# 再带 header 写入
curl -X POST http://127.0.0.1:<port>/api/watch-history \
  -H "Content-Type: application/json" \
  -H "X-Watch-History-Token: <token>" \
  -d '{"platform":"bilibili","content_id":"BV1xx","title":"标题"}'
```

鉴权：Host / Origin / Sec-Fetch-Site 同源校验；token 用 `timingSafeEqual` 定长比较。

### CLI

```bash
node tools/add.mjs out/record.json
```

## 数据格式

完整 schema 见 [schema/history.schema.json](schema/history.schema.json)。

| 字段 | 必填 | 说明 |
|---|---|---|
| `platform` | 是 | 任意字符串，如 `bilibili` / `github` / `xiaohongshu` |
| `content_id` | 是 | 平台内容 ID；B站 BV 号 |
| `title` | 是 | 标题 |
| `started_at` | 否 | ISO 时间，默认现在 |
| `status` | 否 | `watched` / `metadata_only` / `reference_only` |
| `seen` | 否 | 看了/没看；不填按 status 推导 |
| `view_mode` | 否 | 观看方式 |
| `url` / `creator` / `cover_url` | 否 | 原链接、作者、封面 |
| `media_type` | 否 | `video` / `post` / `article` 等 |
| `one_liner` / `tags` | 否 | 一句话感受、标签数组 |
| `source_agent` | 否 | 写入者标识 |

存储是 append-only JSONL，一行一条；排序和筛选在读取时做。

## 它是怎么跑的

```text
DSH 插件 host
  ├─ 注册 /api/watch-history 路由（同源 + token）
  ├─ 注册 watch_history_add 工具
  └─ 读取 history.jsonl，排序/筛选/统计

DSH client
  └─ 设置页「观看历史」：bootstrap → 拉数据 → 卡片墙
```

- 只监听本机，不要暴露公网；
- 不访问平台页面、不保存平台凭据；
- B站/GitHub 元数据补全使用公开接口，失败就留空或用占位图；
- 数据只在本地，删除 JSONL 里的行即可删除记录。

## 常见问题

**设置页显示「无权限」？**  
先确认插件是 0.1.1；打开设置页会先 `bootstrap` 拿 token。仍失败就看 DSH 日志里的 401/403。

**装完是空历史？**  
正常。默认数据目录是新文件；要么写一条记录，要么把 `dataFile` 指到你已有的 JSONL。

**封面是蓝色占位图？**  
该记录没有 `cover_url`，或图片加载失败。公开仓库默认用 `assets/fallback.svg`；本地可用 `fallbackImage` 换成自己的图。

**B站封面/标题没补上？**  
B站接口可能超时/风控；5 秒超时后保留空值，不影响记录写入。

**重复卡片？**  
当前 append-only，不做 upsert；同一条调用两次会两张卡。

**桌面版 CLI 装不上？**  
正常，desktop profile 由 App 管理；用 Settings → Plugins。

## 开发与测试

```bash
npm test
```

覆盖：store/query 排序、Provider/声明式补字段、鉴权矩阵、config BOM/坏 JSON（纯 Node `assert` 脚本）。

目录：

```text
index.js              host 插件入口（路由 + 工具）
client.js             设置页客户端
src/                  store / auth / add / resolve / provider / declarative
tools/                add / render / serve / watch / migrate-seen
schema/               JSON Schema
test/                 node:test 风格测试
assets/fallback.svg   通用占位图
```

## 隐私与安全

- 不收集遥测，不上传历史；
- 不需要 B站账号/cookie；
- HTTP 只在本机回环地址；
- 公开仓库不包含 `config.json`、本地历史、私人图片；
- 如果部署到公网，请自己在前面加反向代理鉴权。

## License

MIT。`assets/fallback.svg` 为代码自带通用占位图。
