import { z } from 'zod'

export const nodeKindSchema = z.enum(['page', 'api', 'service', 'module', 'file', 'external'])
export type NodeKind = z.infer<typeof nodeKindSchema>

export const runtimeSchema = z.enum(['client', 'server', 'shared'])
export type Runtime = z.infer<typeof runtimeSchema>

export const scanNodeSchema = z.object({
  /** 穩定 ID:相對路徑或路由路徑,curation merge 的依據 */
  id: z.string(),
  kind: nodeKindSchema,
  /** 自動推斷的預設名稱 */
  label: z.string(),
  filePath: z.string().optional(),
  route: z.string().optional(),
  httpMethods: z.array(z.string()).optional(),
  runtime: runtimeSchema.optional(),
  /** 行數,可用於節點大小 */
  loc: z.number().optional(),
})
export type ScanNode = z.infer<typeof scanNodeSchema>

export const edgeKindSchema = z.enum(['import', 'fetch', 'service-call'])
export type EdgeKind = z.infer<typeof edgeKindSchema>

export const scanEdgeSchema = z.object({
  /** `${source}->${target}:${kind}` */
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: edgeKindSchema,
  /** false = 動態 URL 等無法靜態確定的呼叫 */
  resolved: z.boolean(),
})
export type ScanEdge = z.infer<typeof scanEdgeSchema>

export const scanGraphSchema = z.object({
  version: z.literal(1),
  scannedAt: z.string(),
  root: z.string(),
  nodes: z.array(scanNodeSchema),
  edges: z.array(scanEdgeSchema),
})
export type ScanGraph = z.infer<typeof scanGraphSchema>

export function edgeId(source: string, target: string, kind: EdgeKind): string {
  return `${source}->${target}:${kind}`
}

/** 動態 URL 無法解析的 fetch 呼叫聚集到這個節點,供人工補連線 */
export const UNRESOLVED_NODE_ID = 'unresolved:fetch'
