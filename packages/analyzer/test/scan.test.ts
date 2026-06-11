import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scanProject, UNRESOLVED_NODE_ID } from '../src'
import type { EdgeKind } from '@codecarto/shared'

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/next-app')
const graph = scanProject({ root: fixture })

const node = (id: string) => graph.nodes.find((n) => n.id === id)
const edge = (source: string, target: string, kind: EdgeKind) =>
  graph.edges.find((e) => e.source === source && e.target === target && e.kind === kind)

describe('Next.js 語意節點', () => {
  it('偵測 App Router page,route group 不出現在路由', () => {
    expect(node('page:/')).toMatchObject({ kind: 'page', route: '/' })
    expect(node('page:/dashboard/settings')).toMatchObject({ kind: 'page', route: '/dashboard/settings' })
  })

  it('偵測 route handler 與 HTTP methods(function 與 const 匯出)', () => {
    expect(node('api:/api/users')).toMatchObject({ kind: 'api', httpMethods: ['GET', 'POST'] })
    expect(node('api:/api/users/[id]')).toMatchObject({ kind: 'api', httpMethods: ['GET'] })
  })

  it('偵測 Pages Router 的 page 與 api', () => {
    expect(node('page:/legacy')).toMatchObject({ kind: 'page', route: '/legacy' })
    expect(node('api:/api/health')).toMatchObject({ kind: 'api', route: '/api/health' })
  })

  it('pages/_app 等特殊檔視為一般檔案', () => {
    expect(node('pages/_app.tsx')).toMatchObject({ kind: 'file' })
  })

  it("'use client' 檔案標記 runtime: client", () => {
    expect(node('src/components/UserList.tsx')?.runtime).toBe('client')
    expect(node('api:/api/users')?.runtime).toBe('server')
  })
})

describe('import 圖', () => {
  it('解析 tsconfig paths alias', () => {
    expect(edge('page:/', 'src/components/UserList.tsx', 'import')).toBeTruthy()
  })

  it('barrel file 展開到真實來源', () => {
    expect(edge('page:/', 'src/lib/utils.ts', 'import')).toBeTruthy()
    expect(edge('page:/', 'src/lib/index.ts', 'import')).toBeFalsy()
    expect(edge('page:/dashboard/settings', 'src/lib/db.ts', 'import')).toBeTruthy()
  })

  it('解析 dynamic import', () => {
    expect(edge('page:/', 'src/components/Chart.tsx', 'import')).toBeTruthy()
  })

  it('外部套件聚合為 external 節點', () => {
    expect(node('external:react')).toMatchObject({ kind: 'external' })
    expect(edge('src/components/UserList.tsx', 'external:react', 'import')).toBeTruthy()
  })

  it('測試檔被預設排除', () => {
    expect(node('src/lib/utils.test.ts')).toBeUndefined()
  })
})

describe('fetch → API 連線', () => {
  it('字面值 URL 連到對應 API 節點(resolved: true)', () => {
    expect(edge('src/components/UserList.tsx', 'api:/api/users', 'fetch')).toMatchObject({ resolved: true })
    expect(edge('page:/dashboard/settings', 'api:/api/users', 'fetch')).toMatchObject({ resolved: true })
  })

  it('模板字串前綴唯一命中時連線並標記 resolved: false', () => {
    expect(edge('src/components/UserList.tsx', 'api:/api/users/[id]', 'fetch')).toMatchObject({ resolved: false })
  })

  it('無法判定的動態 URL 收進未解析節點', () => {
    expect(edge('src/components/UserList.tsx', UNRESOLVED_NODE_ID, 'fetch')).toMatchObject({ resolved: false })
  })
})

describe('service 偵測', () => {
  it('Prisma → Database 節點', () => {
    expect(node('service:database-prisma')).toMatchObject({ kind: 'service' })
    expect(edge('src/lib/db.ts', 'service:database-prisma', 'service-call')).toBeTruthy()
  })

  it('stripe → Payments 節點', () => {
    expect(edge('src/services/billing.ts', 'service:payments-stripe', 'service-call')).toBeTruthy()
  })

  it('service import 不重複建立 external 節點', () => {
    expect(node('external:stripe')).toBeUndefined()
    expect(node('external:@prisma/client')).toBeUndefined()
  })
})

describe('graph 輸出', () => {
  it('節點與邊依 id 穩定排序', () => {
    const nodeIds = graph.nodes.map((n) => n.id)
    expect(nodeIds).toEqual([...nodeIds].sort())
    const edgeIds = graph.edges.map((e) => e.id)
    expect(edgeIds).toEqual([...edgeIds].sort())
  })
})
