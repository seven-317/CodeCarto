import type { CartoMapFile, ScanGraph } from '@codecarto/shared'

export async function fetchGraph(): Promise<ScanGraph> {
  const res = await fetch('/api/graph')
  if (!res.ok) throw new Error(`GET /api/graph ${res.status}`)
  return res.json()
}

export async function fetchMap(): Promise<CartoMapFile> {
  const res = await fetch('/api/map')
  if (!res.ok) throw new Error(`GET /api/map ${res.status}`)
  return res.json()
}

export async function postMap(map: CartoMapFile): Promise<void> {
  const res = await fetch('/api/map', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(map),
  })
  if (!res.ok) throw new Error(`POST /api/map ${res.status}`)
}

/** watch mode:訂閱 server 推送的新 graph,斷線自動重連 */
export function subscribeGraph(onGraph: (graph: ScanGraph) => void): () => void {
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
