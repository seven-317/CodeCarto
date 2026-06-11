import { z } from 'zod'

export const edgeStyleSchema = z.object({
  color: z.string().optional(),
  dashed: z.boolean().optional(),
})
export type EdgeStyle = z.infer<typeof edgeStyleSchema>

export const annotationSchema = z.discriminatedUnion('type', [
  // 人工補的邏輯連線
  z.object({
    type: z.literal('edge'),
    id: z.string(),
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    style: edgeStyleSchema.optional(),
  }),
  z.object({
    type: z.literal('text'),
    id: z.string(),
    x: z.number(),
    y: z.number(),
    text: z.string(),
  }),
  z.object({
    type: z.literal('frame'),
    id: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    label: z.string().optional(),
  }),
])
export type Annotation = z.infer<typeof annotationSchema>

export const nodeCurationSchema = z.object({
  /** 人工改名,如「會員登入系統」 */
  label: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  hidden: z.boolean().optional(),
  groupId: z.string().optional(),
  /** 重掃後不被自動佈局移動 */
  pinned: z.boolean().optional(),
})
export type NodeCuration = z.infer<typeof nodeCurationSchema>

export const groupCurationSchema = z.object({
  label: z.string(),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
})
export type GroupCuration = z.infer<typeof groupCurationSchema>

export const namedViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** 此視圖顯示的節點;空陣列 = 全部 */
  nodeIds: z.array(z.string()),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
})
export type NamedView = z.infer<typeof namedViewSchema>

export const cartoMapFileSchema = z.object({
  version: z.literal(1),
  nodes: z.record(z.string(), nodeCurationSchema),
  groups: z.record(z.string(), groupCurationSchema),
  layout2d: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  annotations: z.array(annotationSchema),
  views: z.array(namedViewSchema),
})
export type CartoMapFile = z.infer<typeof cartoMapFileSchema>

export function emptyMapFile(): CartoMapFile {
  return { version: 1, nodes: {}, groups: {}, layout2d: {}, annotations: [], views: [] }
}

/**
 * 穩定排序 + 2 空格縮排,確保 git diff 可讀。
 * record 的 key 依字典序排序;陣列維持原順序。
 */
export function serializeMapFile(map: CartoMapFile): string {
  const sortRecord = <T>(rec: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(rec).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

  const ordered: CartoMapFile = {
    version: map.version,
    nodes: sortRecord(map.nodes),
    groups: sortRecord(map.groups),
    layout2d: sortRecord(map.layout2d),
    annotations: map.annotations,
    views: map.views,
  }
  return JSON.stringify(ordered, null, 2) + '\n'
}
