#!/usr/bin/env node
/**
 * 把 demo SPA 與資料放進 site/public/demo,讓 Next 以靜態資產提供:
 *   - UI 的 demo build(VITE_CARTO_DEMO=1)→ public/demo/
 *   - CLI 掃 fixture 產 graph JSON → public/demo/demo-graph.json
 *   - 策展示範 map → public/demo/demo-map.json
 *
 * 在 site 的 `build` 與 `dev` 前自動執行。需要先建好 packages/cli/dist
 * (turbo 透過 devDependency 排序保證;若手動跑 next dev 而未 build,會
 *  印提示後略過,讓站體仍能啟動,只是 demo iframe 暫時 404)。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(siteDir, '..')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const publicDemo = path.join(siteDir, 'public/demo')

if (!fs.existsSync(cli)) {
  console.warn('[prepare-demo] 找不到 packages/cli/dist — 先跑 `pnpm build`;暫時略過 demo 資料')
  process.exit(0)
}

fs.rmSync(publicDemo, { recursive: true, force: true })
fs.mkdirSync(publicDemo, { recursive: true })

// 1. demo SPA build
execFileSync('pnpm', ['--filter', '@codecarto/ui', 'build:demo'], { cwd: root, stdio: 'inherit' })
fs.cpSync(path.join(root, 'packages/ui/dist-demo'), publicDemo, { recursive: true })

// 2. demo 資料:掃 fixture 產 graph + 策展示範 map
const graphJson = execFileSync(
  'node',
  [cli, 'scan', 'packages/analyzer/test/fixtures/next-app', '--json'],
  { cwd: root, maxBuffer: 64 * 1024 * 1024 },
)
fs.writeFileSync(path.join(publicDemo, 'demo-graph.json'), graphJson)
fs.copyFileSync(path.join(siteDir, 'demo-map.json'), path.join(publicDemo, 'demo-map.json'))

console.log(`[prepare-demo] demo 已就緒 → ${publicDemo}`)
