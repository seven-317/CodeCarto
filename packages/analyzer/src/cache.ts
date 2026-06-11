import fs from 'node:fs'
import path from 'node:path'
import { scanGraphSchema, type ScanGraph } from '@codecarto/shared'

/** 分析快取統一放使用者專案的 node_modules/.cache/codecarto/ */
export function cacheDir(root: string): string {
  return path.join(root, 'node_modules', '.cache', 'codecarto')
}

export function saveGraphCache(root: string, graph: ScanGraph): void {
  try {
    const dir = cacheDir(root)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph))
  } catch {
    // 快取寫入失敗不影響功能
  }
}

export function loadGraphCache(root: string): ScanGraph | null {
  try {
    const raw = fs.readFileSync(path.join(cacheDir(root), 'graph.json'), 'utf8')
    return scanGraphSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}
