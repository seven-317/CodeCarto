import { emptyMapFile, type CartoMapFile, type ScanGraph } from '@codecarto/shared'

/**
 * demo build(VITE_CARTO_DEMO=1):graph / map 改從同目錄靜態 JSON 載入,
 * 不連 server 也不開 WebSocket;策展操作只存在記憶體,重新整理即還原。
 * 用於文件站的線上 demo(GitHub Pages 等純靜態環境)。
 */
export const IS_DEMO = import.meta.env.VITE_CARTO_DEMO === '1'

export async function fetchGraph(): Promise<ScanGraph> {
  const url = IS_DEMO ? `${import.meta.env.BASE_URL}demo-graph.json` : '/api/graph'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`)
  return res.json()
}

export async function fetchMap(): Promise<CartoMapFile> {
  if (IS_DEMO) {
    const res = await fetch(`${import.meta.env.BASE_URL}demo-map.json`)
    return res.ok ? res.json() : emptyMapFile()
  }
  const res = await fetch('/api/map')
  if (!res.ok) throw new Error(`GET /api/map ${res.status}`)
  return res.json()
}

export async function postMap(map: CartoMapFile): Promise<void> {
  if (IS_DEMO) return
  const res = await fetch('/api/map', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(map),
  })
  if (!res.ok) throw new Error(`POST /api/map ${res.status}`)
}

/** watch mode:訂閱 server 推送的新 graph,斷線自動重連 */
export function subscribeGraph(onGraph: (graph: ScanGraph) => void): () => void {
  if (IS_DEMO) return () => {}
  let ws: WebSocket | null = null
  let closed = false
  let retry: ReturnType<typeof setTimeout> | null = null

  const connect = () => {
    if (closed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws`)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string)
        if (msg.type === 'graph') onGraph(msg.graph as ScanGraph)
      } catch {
        // 忽略非預期訊息
      }
    }
    ws.onclose = () => {
      if (!closed) retry = setTimeout(connect, 2000)
    }
  }
  connect()

  return () => {
    closed = true
    if (retry) clearTimeout(retry)
    ws?.close()
  }
}
