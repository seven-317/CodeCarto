// 把 ui package 的 build 產物複製進 cli 的 dist/ui,隨 npm 套件發佈
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(here, '../../ui/dist')
const dest = path.resolve(here, '../dist/ui')

if (!fs.existsSync(src)) {
  console.warn('[codecarto] packages/ui/dist 不存在,略過 UI 複製(請先 build ui)')
  process.exit(0)
}
fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })
console.log(`[codecarto] UI 靜態檔已複製到 ${dest}`)
