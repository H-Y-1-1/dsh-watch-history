# dsh-watch-history

> 版本：0.1.1 · [Changelog](CHANGELOG.md)

跨平台观看历史 DSH 插件：把「看过什么」存成统一记录，并在设置页用卡片墙展示。

- 任意平台：`platform` 只是字符串，不要求插件提前支持
- 有封面用封面，没封面用通用占位图
- 支持记录级 `seen` / `view_mode`（看了/没看、抽帧/字幕/AI 审片/完整播放）
- Provider / 声明式 API 两种元数据扩展
- 本地 HttpOnly token + 同源校验
- 不抓平台、不保存 cookie，数据由调用方写入

## 安装（GitHub）

DSH → Settings → Plugins → **Add plugin**，填本仓库地址。

> 桌面版 profile 由 Electron 应用管理，不要用 `dsh plugin --profile desktop add`。

## 配置

复制 `config.example.json` 为 `config.json`（不要提交到仓库）：

```json
{
  "dataFile": "",
  "fallbackImage": "",
  "provider": { "url": "", "timeout_ms": 3000 },
  "adapters": []
}
```

- `dataFile`：历史 JSONL 路径；空则默认 `~/.dsh/watch-history/history.jsonl`
- `fallbackImage`：可选的本地兜底图路径；空则用 `assets/fallback.svg`
- `provider` / `adapters`：见 [CONTRACT.md](CONTRACT.md)

## 使用

- 设置页「观看历史」：卡片、平台筛选、看了/没看、搜索、打开原视频
- AI 工具：`watch_history_add`
- HTTP：先 `GET /api/watch-history/bootstrap` 拿 token，再带
  `X-Watch-History-Token` 请求 `GET/POST /api/watch-history`
- CLI：`node tools/add.mjs out/record.json`

## HTTP

```text
GET  /api/watch-history/bootstrap        -> token + HttpOnly cookie
GET  /api/watch-history?limit=&offset=   -> 需要 token/cookie
POST /api/watch-history                  -> 需要 token/cookie + application/json
GET  /api/watch-history/fallback         -> 通用占位图
```

鉴权：Host/Origin/Sec-Fetch-Site 同源校验 + 32 字节随机 token。

## 数据格式

见 [schema/history.schema.json](schema/history.schema.json) 与 [CONTRACT.md](CONTRACT.md)。

核心字段：

```text
platform, content_id, title, started_at
url, creator, cover_url, media_type
seen, view_mode, completed
one_liner, tags, source_agent, status
```

## 范围说明

这个插件是**账本 + 展示层**，不是爬虫：

- 它不会主动发现新视频/帖子；
- 调用方（环境 Agent / Provider / 脚本）负责获取元数据并调用 `watch_history_add`；
- 不抓平台、不保存 cookie；
- 未写入 = 没有记录。

B站/GitHub 有内置公开 API 补全；其他平台可通过 Provider、声明式配置或直接提交 `cover_url`。

## 测试

```bash
npm test
```

## License

MIT。`assets/fallback.svg` 为代码自带通用占位图。
