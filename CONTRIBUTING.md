# Contributing to codecarto

感謝你的興趣!

## 開發環境

Node >= 20、pnpm 10。

```bash
pnpm install
pnpm build
pnpm test
```

## 最容易上手的貢獻:service 偵測規則

`packages/analyzer/src/services.ts` 的 `BUILTIN_SERVICE_RULES` 是一張純資料的規則表 —
新增一條規則(例如 `@upstash/qstash` → Queue)只要一行,加一個 fixture 測試即可。
這類 PR 我們會優先 review,也是 `good-first-issue` 的主要來源。

## 測試

- analyzer 的行為以 fixture 專案驗證:`packages/analyzer/test/fixtures/next-app/`。
  新增解析能力時請同步擴充 fixture 與 `test/scan.test.ts`。
- server 的 API 行為:`packages/server/test/server.test.ts`。

## PR 原則

- 一個 PR 做一件事
- `pnpm build && pnpm typecheck && pnpm test` 全綠
- UI 變更附截圖
