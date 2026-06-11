#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { watch as chokidarWatch } from 'chokidar'
import { Command } from 'commander'
import open from 'open'
import pc from 'picocolors'
import { createScanner, loadConfig, saveGraphCache } from '@codecarto/analyzer'
import { startServer } from '@codecarto/server'
import type { ScanGraph } from '@codecarto/shared'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string
}

const program = new Command()
  .name('codecarto')
  .description('從程式碼自動生成、可人工策展、可向非技術人員簡報的互動式架構地圖')
  .version(pkg.version)

program
  .command('map [dir]', { isDefault: true })
  .description('掃描專案並開啟 localhost 地圖(預設指令)')
  .option('-p, --port <port>', '偏好的 port(被占用時往後找)', '4870')
  .option('-w, --watch', '監看原始碼變更並即時推送更新')
  .option('--no-open', '不自動開啟瀏覽器')
  .action(async (dir: string | undefined, opts: { port: string; watch?: boolean; open: boolean }) => {
    const root = path.resolve(dir ?? process.cwd())
    const { scanner, graph } = await runScan(root)
    let currentGraph = graph

    const server = await startServer({
      projectRoot: root,
      uiDir: uiDir(),
      port: Number.parseInt(opts.port, 10),
      getGraph: () => currentGraph,
    })

    console.log()
    console.log(`  ${pc.bold(pc.cyan('codecarto'))} 已啟動 → ${pc.underline(server.url)}`)
    console.log(pc.dim(`  策展資料:${path.join(root, 'codecarto.map.json')}(建議 commit)`))
    console.log()

    if (opts.watch) {
      startWatcher(root, scanner, (next) => {
        currentGraph = next
        server.broadcastGraph(next)
      })
      console.log(pc.dim('  watch mode:原始碼變更會即時推送到瀏覽器'))
    }
    if (opts.open) await open(server.url)

    const shutdown = async () => {
      await server.close()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })

program
  .command('scan [dir]')
  .description('只執行掃描;--json 輸出 graph JSON 到 stdout 供腳本串接')
  .option('--json', '輸出完整 graph JSON')
  .action(async (dir: string | undefined, opts: { json?: boolean }) => {
    const root = path.resolve(dir ?? process.cwd())
    const { graph } = await runScan(root, { quiet: opts.json })
    if (opts.json) {
      process.stdout.write(JSON.stringify(graph, null, 2) + '\n')
      return
    }
    const byKind = new Map<string, number>()
    for (const n of graph.nodes) byKind.set(n.kind, (byKind.get(n.kind) ?? 0) + 1)
    console.log()
    for (const [kind, count] of [...byKind.entries()].sort()) {
      console.log(`  ${pc.bold(String(count).padStart(4))}  ${kind}`)
    }
    console.log(`  ${pc.bold(String(graph.edges.length).padStart(4))}  edges`)
  })

program
  .command('init [dir]')
  .description('建立 codecarto.config.ts(完全可選,零設定也能跑)')
  .action((dir: string | undefined) => {
    const root = path.resolve(dir ?? process.cwd())
    const file = path.join(root, 'codecarto.config.ts')
    if (fs.existsSync(file)) {
      console.error(pc.red(`已存在:${file}`))
      process.exitCode = 1
      return
    }
    fs.writeFileSync(file, CONFIG_TEMPLATE)
    console.log(`已建立 ${pc.bold(file)}`)
  })

// ---------------------------------------------------------------------------

async function runScan(root: string, opts: { quiet?: boolean } = {}) {
  const log = (msg: string) => {
    if (!opts.quiet) console.error(msg)
  }
  const config = await loadConfig(root)
  log(pc.dim(`掃描 ${root} …`))
  const started = Date.now()
  const scanner = createScanner({ root, config })
  const graph = scanner.scan()
  saveGraphCache(root, graph)
  log(
    pc.dim(
      `完成:${graph.nodes.length} 個節點、${graph.edges.length} 條邊(${((Date.now() - started) / 1000).toFixed(1)}s)`,
    ),
  )
  return { scanner, graph, config }
}

const SOURCE_EXT = /\.(tsx?|jsx?|mts|mjs|cts|cjs)$/
const WATCH_IGNORED = new Set(['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage'])

function startWatcher(
  root: string,
  scanner: ReturnType<typeof createScanner>,
  onGraph: (graph: ScanGraph) => void,
) {
  const pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    timer = null
    const changed = [...pending]
    pending.clear()
    try {
      scanner.refreshPaths(changed)
      const graph = scanner.scan()
      saveGraphCache(root, graph)
      onGraph(graph)
      console.log(pc.dim(`  重掃完成(${changed.length} 個檔案變更)`))
    } catch (err) {
      console.error(pc.red(`  重掃失敗:${(err as Error).message}`))
    }
  }

  const watcher = chokidarWatch(root, {
    ignoreInitial: true,
    // chokidar v4 不支援 glob,用函式過濾
    ignored: (p) => p.split(path.sep).some((seg) => WATCH_IGNORED.has(seg)),
  })

  watcher.on('all', (_event, filePath) => {
    if (!SOURCE_EXT.test(filePath)) return
    pending.add(filePath)
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, 300)
  })
}

function uiDir(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'ui')
}

const CONFIG_TEMPLATE = `import { defineConfig } from 'codecarto'

export default defineConfig({
  // root: '.',
  // tsconfig: './tsconfig.json',
  // include: ['src', 'app'],
  // exclude: ['**/*.stories.tsx'],
  // services: [
  //   { match: 'import:@upstash/redis', label: 'Redis', icon: 'database' },
  // ],
})
`

// 注意:必須在所有 const 宣告之後才 parse,
// action 回呼會在模組評估完成前執行,提前 parse 會踩到未初始化的綁定
await program.parseAsync()
