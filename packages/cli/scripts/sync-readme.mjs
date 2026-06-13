#!/usr/bin/env node
// npm 頁面顯示套件目錄的 README;這裡把 repo 根 README.md 同步進來,讓 npm 與 GitHub 一致。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(cliDir, '../..')
fs.copyFileSync(path.join(root, 'README.md'), path.join(cliDir, 'README.md'))
console.log('[sync-readme] README.md ← repo root')
