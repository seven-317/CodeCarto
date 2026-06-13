#!/usr/bin/env node
/**
 * 把 demo SPA 與資料放進 site/public/demo,讓 Next 以靜態資產提供:
 *   - UI 的 demo build(VITE_CARTO_DEMO=1)→ public/demo/
 *   - CLI 掃 fixture 產 graph JSON → public/demo/demo-graph.json
 *   - 策展示範 map → public/demo/demo-map.json
 *
 * 在 site 的 `build`(prebuild,帶 --ensure)與 `dev`(predev)前執行。
 * --ensure:CLI 未建好時用 turbo 先建(Vercel 只建 site/、未跑根 build 時需要)。
 * 無 --ensure(dev):缺 CLI 就略過,讓 dev 仍能啟動。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ensure = process.argv.includes('--ensure')
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(siteDir, '..')
const cli = path.join(root, 'packages/cli/dist/cli.js')
const publicDemo = path.join(siteDir, 'public/demo')
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' })

if (!fs.existsSync(cli)) {
  if (!ensure) {
    console.warn('[prepare-demo] 找不到 packages/cli/dist — 先跑 `pnpm build`;暫時略過 demo 資料')
    process.exit(0)
  }
  // Vercel 只建 site/,需自行把 CLI + 其相依(turbo ^build 排序)建起來
  console.log('[prepare-demo] 建置 CLI 與相依套件…')
  run('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=codecarto'])
}

fs.rmSync(publicDemo, { recursive: true, force: true })
fs.mkdirSync(publicDemo, { recursive: true })

// 1. demo SPA build
run('pnpm', ['--filter', '@codecarto/ui', 'build:demo'])
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
