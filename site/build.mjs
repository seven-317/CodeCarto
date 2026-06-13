#!/usr/bin/env node
/**
 * 組裝文件站 + demo 站到 site/dist:
 *   1. 文件站:Next.js static export(site/out)→ site/dist
 *   2. 根轉址:site/dist/index.html → ./en/(localePrefix 'always',根無頁面)
 *   3. demo 站:UI 的 demo build(VITE_CARTO_DEMO=1)→ site/dist/demo/
 *   4. demo 資料:CLI 掃 fixture 產 graph JSON + 策展示範 map → site/dist/demo/
 *
 * 前置:先跑過 `pnpm build`(需要 packages/cli/dist/cli.js)。
 * NEXT_PUBLIC_BASE_PATH(如 /CodeCarto)由 CI 注入給 Next basePath。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteDir = path.join(root, 'site')
const outDir = path.join(siteDir, 'dist')
const cli = path.join(root, 'packages/cli/dist/cli.js')

if (!fs.existsSync(cli)) {
  console.error('找不到 packages/cli/dist/cli.js — 請先跑 `pnpm build`')
  process.exit(1)
}

fs.rmSync(outDir, { recursive: true, force: true })

// 1. 文件站:Next.js static export
execFileSync('pnpm', ['--filter', '@codecarto/site', 'build'], { cwd: root, stdio: 'inherit' })
fs.cpSync(path.join(siteDir, 'out'), outDir, { recursive: true })

// 2. 根轉址 → 預設 locale(相對路徑,與 basePath 無關)
fs.writeFileSync(
  path.join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>codecarto</title>` +
    `<meta http-equiv="refresh" content="0; url=./en/">` +
    `<link rel="canonical" href="./en/"><a href="./en/">codecarto</a>`,
)

// 3. demo 站(UI demo build)
execFileSync('pnpm', ['--filter', '@codecarto/ui', 'build:demo'], { cwd: root, stdio: 'inherit' })
fs.cpSync(path.join(root, 'packages/ui/dist-demo'), path.join(outDir, 'demo'), { recursive: true })

// 4. demo 資料:掃 fixture 產 graph + 策展示範 map
const graphJson = execFileSync(
  'node',
  [cli, 'scan', 'packages/analyzer/test/fixtures/next-app', '--json'],
  { cwd: root, maxBuffer: 64 * 1024 * 1024 },
)
fs.writeFileSync(path.join(outDir, 'demo/demo-graph.json'), graphJson)
fs.copyFileSync(path.join(siteDir, 'demo-map.json'), path.join(outDir, 'demo/demo-map.json'))

console.log(`site 組裝完成 → ${outDir}`)
