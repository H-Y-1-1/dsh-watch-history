# Changelog

## 0.1.1 — 2026-10-25

- fix: `config.json` 现在兼容 UTF-8 BOM；之前带 BOM 时会被静默忽略并回退默认数据目录。
- fix: `tools/add.mjs` 按 `WATCH_HISTORY_FILE` / `config.json` 的 `dataFile` 写入，不再固定写工作区。
- test: 新增 `test/config.test.mjs`，覆盖 BOM、正常 JSON、坏 JSON、缺失文件。
- docs: README 按「适合谁 / 解决什么问题 / 安装 / 配置 / 排错」重写，并加入截图。

## 0.1.0 — 2026-10-24

- 首个公开版本：观看历史卡片墙、平台筛选、看了/没看、搜索。
- `watch_history_add` 工具、HTTP API、本地同源 + token 鉴权。
- B站/GitHub 元数据补全，Provider / 声明式 API 扩展。
- 默认数据目录 `~/.dsh/watch-history/history.jsonl`，可用 `config.json` 覆盖。
- 通用 `assets/fallback.svg` 兜底图。
