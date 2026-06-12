# codecarto

> 從程式碼自動生成、可人工策展、可向非技術人員簡報的互動式架構地圖。

```bash
npx codecarto
```

工程師需要向看不懂程式碼的人(甲方、PM、主管)解釋系統架構。手繪架構圖三個月就過時;自動生成的依賴圖又是幾百個節點的毛球。codecarto 的答案是三層結構:

1. **自動分析** — ts-morph 掃描 import / export / dynamic import,加上 Next.js 語意層:Page、API(含 HTTP method)、`fetch('/api/…')` 連線、Prisma / Stripe 等 Service 節點、`'use client'` 邊界。永遠和程式碼同步。
2. **人工策展** — 改名成業務語言(「會員登入系統」)、上色、分組、隱藏、手動補連線。策展存在 `codecarto.map.json`(建議 commit),重掃後依穩定節點 ID 重新疊加,不會因為改檔名就丟失。
3. **溝通** — 點擊節點高亮上下游鏈路、搜尋飛至節點、匯出 PNG 直接貼進簡報。

## 快速開始

```bash
# 在任何 TS / Next.js 專案根目錄(需有 tsconfig.json)
npx codecarto              # 掃描 + 開啟 localhost 地圖
npx codecarto map --watch  # 監看原始碼,變更即時推送到瀏覽器
npx codecarto scan --json  # 輸出 graph JSON 給腳本串接
npx codecarto init         # 建立 codecarto.config.ts(完全可選)
```

掃描在本機執行,server 只綁定 `127.0.0.1` 並驗證 Origin(DNS rebinding 防護);你的程式碼不會離開你的電腦。

## 設定(可選)

```ts
// codecarto.config.ts
import { defineConfig } from 'codecarto'

export default defineConfig({
  include: ['src', 'app'],
  exclude: ['**/*.stories.tsx'],
  services: [{ match: 'import:@upstash/redis', label: 'Redis', icon: 'database' }],
})
```

## 開發

pnpm workspace + turborepo。發佈為單一套件 `codecarto`,內部分包:

| package | 內容 |
| --- | --- |
| `packages/analyzer` | ts-morph 掃描、Next.js 語意抽取、service 規則表 |
| `packages/server` | localhost HTTP + WebSocket、`codecarto.map.json` 原子寫入 |
| `packages/ui` | Vite + React 19 + xyflow + elkjs 的 2D 畫布 |
| `packages/cli` | commander 入口;打包時把 UI 靜態檔複製進 `dist/ui` |
| `packages/shared` | Graph / MapFile 型別與 zod schema(單一真相來源) |

```bash
pnpm install
pnpm build       # 全部 build(cli 會把 ui 產物複製進 dist/ui)
pnpm test        # vitest(analyzer fixture 測試 + server 整合測試)
pnpm typecheck
node packages/cli/dist/cli.js map <某個 Next.js 專案>
```

## Roadmap

- **M2 — 溝通力(已完成)**:簡報模式與路徑導覽、SVG / 自包含 HTML 匯出、NamedView、stale 策展清理與改名遷移
- **M3 — 體驗與傳播**:3D 視圖、大圖虛擬化渲染、文件站與 demo 站

service 偵測規則表(`packages/analyzer/src/services.ts`)是絕佳的社群貢獻入口 — 歡迎 PR。

## License

MIT
