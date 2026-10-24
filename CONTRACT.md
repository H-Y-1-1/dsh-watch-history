# 观看历史 · 提交契约

> 给任何要写入历史的 Agent / 适配器看。**不要求插件预先支持某个平台。**

## 核心原则

历史插件是通用的「存 + 显示」层：

- `platform` 是任意字符串，不枚举、不白名单；
- 没有对应适配器也能写入；
- `cover_url` 有就用图，没有就用兜底鱼图；
- 适配器只是“自动补 url/封面”的便利层，不是准入门槛。

## 必填

```json
{
  "platform": "kuaishou",
  "content_id": "3x...",
  "title": "标题",
  "started_at": "2026-10-24T18:00:00+08:00"
}
```

## 推荐字段

```json
{
  "url": "https://...",
  "creator": "作者",
  "cover_url": "https://.../image.jpg",
  "media_type": "video | post | thread",
  "seen": true,
  "view_mode": "full_playback | frames | subtitle | frames+subtitle | ai_review | metadata | reference",
  "one_liner": "一句话",
  "tags": ["标签"],
  "source_agent": "你的 agent 名",
  "status": "watched | metadata_only | reference_only"
}
```

## 图片规则

- `cover_url` 是**第一张图/封面**的 URL；
- 插件用 `object-fit: cover` 裁成卡片比例；
- 没有 `cover_url`，或图片加载失败 → 统一兜底鱼图；
- 外部 Agent 抓不到图就不填，不会报错；
- 图必须能被 DSH 浏览器访问；防盗链图可能失败，失败会自动兜底。

## 平台示例

### 快手（未内置适配器）

```json
{
  "platform": "kuaishou",
  "content_id": "3xabc",
  "title": "快手视频",
  "url": "https://www.kuaishou.com/short-video/3xabc",
  "cover_url": "https://.../kuaishou.jpg",
  "seen": true,
  "view_mode": "frames+subtitle",
  "source_agent": "external-agent"
}
```

没有 `cover_url` 也能写，页面会显示鱼图。

### 贴吧（帖子）

```json
{
  "platform": "tieba",
  "content_id": "1234567890",
  "title": "帖子标题",
  "url": "https://tieba.baidu.com/p/1234567890",
  "media_type": "thread",
  "seen": true,
  "view_mode": "subtitle",
  "source_agent": "external-agent"
}
```

## 写入方式

1. DSH 工具：`watch_history_add`
2. HTTP：先 `GET /api/watch-history/bootstrap` 拿 `token`（或 HttpOnly cookie），再带 `X-Watch-History-Token` / cookie 调 `POST /api/watch-history`（`application/json`）
3. 本地脚本：`node plugins/watch-history/tools/add.mjs out/record.json`

## 元数据补全优先级

```text
1. 记录自带 title / cover_url
2. 内置适配器（B站公开 view API、GitHub API、页面 OG）
3. 目标环境 Provider
4. 声明式 API 配置
5. 鱼图兜底
```

Provider / 配置只补缺失字段，不覆盖调用方已经给的值。

## 目标环境配置

配置文件（默认）：

```text
plugins/watch-history/config.json
```

可用环境变量覆盖：`WATCH_HISTORY_CONFIG=/path/to/watch-history.json`。示例见 `config.example.json`。

## 外部 Provider 契约

```json
{
  "provider": {
    "url": "http://127.0.0.1:9999/resolve-media",
    "timeout_ms": 3000,
    "headers": {}
  }
}
```

请求：

```json
POST /resolve-media
{ "schema_version": 1, "platform": "douyin", "url": "https://...", "content_id": "..." }
```

响应：

```json
{
  "schema_version": 1,
  "title": "标题",
  "creator": "作者",
  "cover_url": "https://.../cover.jpg",
  "media_type": "video",
  "one_liner": "一句话"
}
```

Provider 负责登录态/签名/浏览器；历史插件不读 Provider 的 cookie。超时/失败自动跳过。

## 声明式 API 配置

在 `config.json` 的 `adapters` 数组：

```json
{
  "platform": "foo",
  "url_pattern": "foo\\.com/v/(\\d+)",
  "api": "https://api.foo.com/v/{id}",
  "timeout_ms": 4000,
  "headers": { "referer": "https://foo.com/" },
  "media_type": "video",
  "fields": {
    "title": "data.title",
    "creator": "data.author.name",
    "cover_url": "data.cover.url"
  }
}
```

- `url_pattern` 第一个捕获组作为 `{id}`；
- `api` 里的 `{id}` 会替换并 URL 编码；
- `fields` 是 JSON 点路径；
- 只支持 GET JSON，不执行代码/签名；
- 失败自动下一条/下一层。

## 安全边界

- 只允许 http/https；
- 超时 ≤10 秒，响应 ≤1 MiB；
- Provider/API 配置由目标环境自己填；
- 不要把 token 写进历史记录；
- 不建议把 Provider 端口暴露到公网；
- 未知平台不阻塞：兜底标题 + 鱼图。

## 适配器

内置适配器（B站/GitHub/OG）负责自动补；没有适配器也可以写入，未知平台走通用路径。

**没有适配器 ≠ 不能显示。**
