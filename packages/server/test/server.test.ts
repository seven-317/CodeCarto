import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ScanGraph } from '@codecarto/shared'
import { startServer, type CartoServer } from '../src'

const graph: ScanGraph = {
  version: 1,
  scannedAt: new Date().toISOString(),
  root: '/tmp/project',
  nodes: [{ id: 'page:/', kind: 'page', label: '/' }],
  edges: [],
}

let server: CartoServer
let projectRoot: string

beforeAll(async () => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codecarto-test-'))
  server = await startServer({
    projectRoot,
    uiDir: path.join(projectRoot, 'no-ui'),
    getGraph: () => graph,
  })
})

afterAll(async () => {
  await server.close()
  fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('API', () => {
  it('GET /api/graph 回傳掃描結果', async () => {
    const res = await fetch(`${server.url}/api/graph`)
    const body = await res.json()
    expect(body.nodes[0].id).toBe('page:/')
  })

  it('GET /api/map 在無檔案時回傳空 map', async () => {
    const res = await fetch(`${server.url}/api/map`)
    const body = await res.json()
    expect(body).toMatchObject({ version: 1, nodes: {}, annotations: [] })
  })

  it('POST /api/map 原子寫入並穩定排序', async () => {
    const map = {
      version: 1,
      nodes: { 'z.ts': { label: 'Z' }, 'a.ts': { label: '會員登入系統' } },
      groups: {},
      layout2d: {},
      annotations: [],
      views: [],
    }
    const res = await fetch(`${server.url}/api/map`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(map),
    })
    expect((await res.json()).ok).toBe(true)

    const written = fs.readFileSync(path.join(projectRoot, 'codecarto.map.json'), 'utf8')
    expect(written.indexOf('"a.ts"')).toBeLessThan(written.indexOf('"z.ts"'))
    expect(written.endsWith('\n')).toBe(true)
  })

  it('POST /api/map 拒絕不合 schema 的內容', async () => {
    const res = await fetch(`${server.url}/api/map`, {
      method: 'POST',
      body: JSON.stringify({ version: 99 }),
    })
    expect(res.status).toBe(400)
  })

  it('拒絕非本機 Origin(DNS rebinding 防護)', async () => {
    const res = await fetch(`${server.url}/api/graph`, {
      headers: { origin: 'http://evil.example.com' },
    })
    expect(res.status).toBe(403)
  })
})
