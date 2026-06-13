# codecarto

> 從程式碼自動生成、可人工策展、可向非技術人員簡報的互動式架構地圖。

**[English](README.md) · [繁體中文](README.zh-tw.md)** · **[線上 demo](https://seven-317.github.io/CodeCarto/)**

```bash
npx codecarto
```

工程師需要不斷向看不懂程式碼的人(甲方、PM、主管)解釋系統怎麼接起來。手繪架構圖三個月就過時;自動生成的依賴圖又是幾百個節點、沒人讀得懂的毛球。codecarto 用三層結構卡在兩者之間:

1. **自動分析** — ts-morph 掃描 `import` / `export` / dynamic `import`,加上 Next.js 語意層:Page、API(含 HTTP method)、`fetch('/api/…')` 連線、Service 節點(Prisma、Stripe …)、`'use client'` 邊界。永遠和程式碼同步。
2. **人工策展** — 改名成業務語言(「會員登入系統」)、上色、分組、隱藏、釘選、手動補連線。策展存在 `codecarto.map.json`(建議 commit),重掃後依**穩定節點 ID** 重新疊加,改檔名也不會丟失。
3. **溝通** — 點擊節點高亮上下游鏈路、搜尋飛至節點、簡報模式沿資料流逐步走訪、匯出 PNG / SVG / 自包含互動式 HTML 直接交給甲方。

全部在本機執行。server 只綁定 `127.0.0.1` 並驗證 `Origin` header(DNS rebinding 防護);你的程式碼不會離開你的電腦。

## 快速開始

```bash
# 在任何 TS / Next.js 專案根目錄(需有 tsconfig.json)
npx codecarto              # 掃描 + 開啟 localhost 地圖
npx codecarto map --watch  # 監看原始碼,變更即時推送到瀏覽器
npx codecarto scan --json  # 輸出 graph JSON 給腳本串接
npx codecarto init         # 建立 codecarto.config.ts(完全可選)

# 全域安裝後可用 cct 縮寫(cc 留給 Claude Code)
npm i -g codecarto
cct map --watch
```

首次執行會掃描專案、開啟瀏覽器,除了你開始策展後寫入專案根目錄的 `codecarto.map.json` 之外,不會動到任何檔案。

## CLI 參考

| 指令 | 說明 |
| --- | --- |
| `codecarto [map] [dir]` | 掃描 `dir`(預設為當前目錄)並開啟 localhost 地圖。`map` 是預設指令,所以 `codecarto` 單獨執行即可。 |
| `codecarto scan [dir]` | 只掃描,印出 kind/edge 統計。加 `--json` 把完整 graph JSON 輸出到 stdout。 |
| `codecarto init [dir]` | 寫出 `codecarto.config.ts` 範本。設定完全可選,零設定也能跑。 |

**`map` 選項**

| 旗標 | 預設 | 說明 |
| --- | --- | --- |
| `-p, --port <port>` | `4870` | 偏好的 port;被占用時往後找下一個。 |
| `-w, --watch` | 關 | 監看原始碼變更並即時推送重掃結果;新節點綠色閃爍。 |
| `--no-open` | 開啟 | 不自動開啟瀏覽器。 |

`cct` 是 `codecarto` 的別名 — 所有指令與旗標完全相同。

## 操作地圖

| 動作 | 方式 |
| --- | --- |
| 高亮鏈路 | 點節點 — 其上下游鏈路保持亮起,其餘變淡。 |
| 改名 | 雙擊節點,或右鍵 → Rename。留空還原自動名稱。 |
| 上色 / 隱藏 / 釘選 / 分組 | 右鍵節點開選單。釘選節點重掃後位置不動。 |
| 手動連線 | 右鍵 → Connect to…,再點目標節點。 |
| 移動 | 拖曳節點,跟著滑鼠走,放開時存檔。 |
| 搜尋 | 工具列搜尋框輸入;Enter 飛至第一個結果。 |
| Externals / Hidden | 工具列 chip 切換外部套件與隱藏節點的顯示。 |
| Relayout | 重算自動佈局;釘選節點不動。 |

**鍵盤** — `Esc` 逐層退出(導覽 → 簡報 → 選取/選單)。簡報模式中 `←` / `→` / `Space` 沿路徑逐段前進。

### 簡報模式

按 **Present** 隱藏所有 chrome(工具列、圖例、minimap、controls)、放大節點名稱、隱藏檔案路徑等技術細節。點任一節點開始**走訪**:其鏈路依 x 座標排成左到右(Page → … → Service),方向鍵逐段前進,鏡頭一個節點一個節點平移,像簡報翻頁。

### NamedView

**Views** 下拉把目前的子集(套用中的過濾、高亮鏈路,或整張地圖)加上目前視角存成具名視圖。套用後畫布只顯示該子集並飛到存檔視角;隨時可切回 **Full map**。視圖存在 `codecarto.map.json`。

### Stale 策展與改名遷移

當策展的節點在 graph 中已不存在(檔案被改名或刪除),工具列出現琥珀色 **Stale N** chip。每筆 stale 紀錄會建議遷移目標 — 同 kind 且同檔名的節點 — 遷移會把 label、顏色、座標、annotations、view 參照一次原子搬移過去。也可單筆或全部清除。

### 匯出

| 格式 | 內容 |
| --- | --- |
| **PNG** | 2× 裝置像素點陣圖,框住整張地圖,與當前縮放/平移無關。 |
| **SVG** | 手刻向量:bezier 邊、各色箭頭 marker、斜紋 service 節點 — 不是 DOM 截圖。 |
| **HTML** | 單一自包含檔案:SVG 加上內嵌的純 JS viewer,可 pan/zoom、點擊高亮鏈路。離線可開,無相依。 |

連線的**封包流動動畫**(封包點沿線從來源流向目標)僅限 host 瀏覽:PNG 匯出時與低 zoom 時隱藏,也不會嵌進 SVG/HTML 匯出。

## 設定(可選)

```ts
// codecarto.config.ts
import { defineConfig } from 'codecarto'

export default defineConfig({
  include: ['src', 'app'],          // 要掃描的 glob(預設自動推斷)
  exclude: ['**/*.stories.tsx'],    // 要略過的 glob
  tsconfig: 'tsconfig.json',        // 覆寫 tsconfig 位置
  services: [
    // 自訂 service 規則,疊加在內建規則表之上
    { match: 'import:@upstash/redis', label: 'Redis', icon: 'database' },
  ],
})
```

service 規則以 module specifier 前綴比對(`import:<前綴>`)。內建規則涵蓋 Prisma、Drizzle、Mongoose、Supabase、Stripe、Resend、Nodemailer、AWS SDK、Upstash/ioredis、Firebase、OpenAI、Anthropic。規則表 — [`packages/analyzer/src/services.ts`](packages/analyzer/src/services.ts) — 是絕佳的社群貢獻入口,歡迎 PR。

## `codecarto.map.json` 格式

專案根目錄的單一 JSON 檔,以穩定 key 排序寫出,確保 git diff 可讀。建議 commit。每筆都以**穩定節點 ID**(相對路徑或路由路徑)為 key,所以重掃後策展會重新疊加。

```jsonc
{
  "version": 1,
  "nodes": {
    "src/components/UserList.tsx": { "label": "會員清單", "color": "#d71921", "pinned": true },
    "service:payments-stripe":     { "label": "金流", "hidden": false, "groupId": "payments" }
  },
  "groups":  { "payments": { "label": "金流", "color": "#4a9e5c" } },
  "layout2d": { "src/components/UserList.tsx": { "x": 120, "y": 80 } },
  "annotations": [
    { "type": "edge", "id": "a1", "from": "page:/", "to": "service:payments-stripe", "label": "結帳" }
  ],
  "views": [
    { "id": "v1", "label": "會員資料流", "nodeIds": ["page:/", "src/components/UserList.tsx"] }
  ]
}
```

| Key | 意義 |
| --- | --- |
| `nodes` | 每節點策展:`label`、`color`、`icon`、`hidden`、`pinned`、`groupId`。 |
| `groups` | 群組定義:`label`、`color`、`collapsed`。 |
| `layout2d` | 手動節點座標;沒有的節點走自動佈局。 |
| `annotations` | 手動 `edge` / `text` / `frame` 疊加。 |
| `views` | NamedView:節點子集(空 = 全部)加上可選視角。 |

## 架構

pnpm workspace + turborepo。發佈為單一套件 `codecarto`,內部分包在 build 時打包進來。

| package | 職責 |
| --- | --- |
| `packages/shared` | Graph / MapFile / Config 型別與 zod schema — 單一真相來源。 |
| `packages/analyzer` | ts-morph 掃描、Next.js 語意抽取、service 規則表、graph 快取。 |
| `packages/server` | localhost HTTP + WebSocket、`codecarto.map.json` 原子寫入、Origin/Host 驗證。 |
| `packages/ui` | Vite + React 19 + xyflow + elkjs 的 2D 畫布與策展 UI。 |
| `packages/cli` | commander 入口;打包時把 UI 產物複製進 `dist/ui`。 |
| `site` | Next.js(App Router、靜態輸出)文件站 + 內嵌 live demo;next-intl 雙語、next-themes 主題。 |

## 開發

```bash
pnpm install
pnpm build        # 全部 build(cli 會把 ui 產物複製進 dist/ui)
pnpm test         # vitest(analyzer fixture 測試 + server 整合測試)
pnpm typecheck
pnpm build:site   # 組裝文件站 + demo 到 site/dist

# 從原始碼對真實專案執行
node packages/cli/dist/cli.js map <某個 Next.js 專案>
```

文件站(`site/`)build 成靜態輸出,push 到 `main` 時透過 `.github/workflows/pages.yml` 部署到 GitHub Pages。線上 demo 把真實 UI 嵌進 demo build(`VITE_CARTO_DEMO=1`):graph 與策展從靜態 JSON 載入、WebSocket 停用、策展只存在記憶體。

## 隱私與安全

- 掃描完全在本機執行。
- server 只綁定 `127.0.0.1` 並驗證 `Host` 與 `Origin` header(DNS rebinding 防護)。
- 分析快取放在 `node_modules/.cache/codecarto/`,不碰你的原始碼樹。
- 寫入專案的唯一檔案是 `codecarto.map.json`。

## Roadmap

- **M1 — 地基** ✅ — analyzer、server、CLI、2D 畫布 + 策展、Nothing 風格 UI(淺色 + 深色)。
- **M2 — 溝通力** ✅ — 簡報模式與路徑導覽、SVG / 自包含 HTML 匯出、NamedView、stale 策展清理與改名遷移。
- **M3 — 體驗與傳播** ✅ — 大圖虛擬化(viewport culling + 低 zoom LOD、密圖 ELK 降級)、文件站 + 線上 demo。
- 已捨棄:3D 視圖 — 中看不中用,2D + 策展 + 簡報模式已涵蓋溝通需求。

## License

MIT
