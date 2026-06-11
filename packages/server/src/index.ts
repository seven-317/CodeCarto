import fs from 'node:fs'
import http from 'node:http'
import getPort, { portNumbers } from 'get-port'
import sirv from 'sirv'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ScanGraph } from '@codecarto/shared'
import { MapStore } from './map-store'

export { MapStore, MAP_FILE_NAME } from './map-store'

export interface ServerOptions {
  /** 使用者專案根目錄(codecarto.map.json 所在) */
  projectRoot: string
  /** 套件內建的預編譯 UI 靜態檔目錄 */
  uiDir: string
  /** 偏好的 port;被占用時往後找 */
  port?: number
  getGraph: () => ScanGraph
}

export interface CartoServer {
  port: number
  url: string
  /** watch mode:推送新 graph 給所有連線中的 UI */
  broadcastGraph(graph: ScanGraph): void
  close(): Promise<void>
}

const DEFAULT_PORT = 4870
const MAX_BODY_BYTES = 20 * 1024 * 1024

/**
 * localhost-only server:綁定 127.0.0.1,並驗證 Host 與 Origin 皆為本機,
 * 防止惡意網頁透過瀏覽器打本機 server(DNS rebinding)。
 */
export async function startServer(options: ServerOptions): Promise<CartoServer> {
  const mapStore = new MapStore(options.projectRoot)
  const hasUi = fs.existsSync(options.uiDir)
  const serveStatic = hasUi ? sirv(options.uiDir, { single: true, dev: false, etag: true }) : null

  const server = http.createServer((req, res) => {
    if (!isLocalRequest(req)) {
      res.writeHead(403).end('Forbidden')
      return
    }

    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (url.pathname === '/api/graph' && req.method === 'GET') {
      return sendJson(res, options.getGraph())
    }

    if (url.pathname === '/api/map') {
      if (req.method === 'GET') {
        try {
          return sendJson(res, mapStore.read())
        } catch (err) {
          return sendJson(res, { error: `codecarto.map.json 讀取失敗:${(err as Error).message}` }, 500)
        }
      }
      if (req.method === 'POST') {
        return void readBody(req)
          .then((body) => {
            mapStore.write(JSON.parse(body))
            sendJson(res, { ok: true })
          })
          .catch((err: Error) => sendJson(res, { error: err.message }, 400))
      }
    }

    if (serveStatic) {
      serveStatic(req, res)
    } else {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('codecarto UI 尚未打包(dist/ui 不存在)。開發時請先 build ui package。')
    }
  })

  const wss = new WebSocketServer({ noServer: true })
  const clients = new Set<WebSocket>()

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname !== '/ws' || !isLocalRequest(req)) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.add(ws)
      ws.on('close', () => clients.delete(ws))
    })
  })

  const port = await getPort({ port: portNumbers(options.port ?? DEFAULT_PORT, (options.port ?? DEFAULT_PORT) + 100) })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    broadcastGraph(graph) {
      const message = JSON.stringify({ type: 'graph', graph })
      for (const ws of clients) {
        if (ws.readyState === ws.OPEN) ws.send(message)
      }
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const ws of clients) ws.terminate()
        wss.close()
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}

function isLocalRequest(req: http.IncomingMessage): boolean {
  const host = req.headers.host?.split(':')[0]
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]') return false
  const origin = req.headers.origin
  if (origin === undefined) return true // 同源導航請求 / curl 沒有 Origin
  try {
    const hostname = new URL(origin).hostname
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  } catch {
    return false
  }
}

function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
