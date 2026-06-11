import { MarkerType, type Edge, type Node } from '@xyflow/react'
import {
  UNRESOLVED_NODE_ID,
  type CartoMapFile,
  type NodeKind,
  type ScanGraph,
} from '@codecarto/shared'
import type { XY } from '../layout'

/**
 * 單色系統:kind 以「左墨條」的明度與圖樣區分(opacity → pattern,不靠色相)。
 * 紅色保留給未解析呼叫 — 全畫面唯一的 interrupt。
 */
export const KIND_META: Record<
  NodeKind,
  { label: string; bar: 'ink' | 'gray' | 'striped' | null; minimap: string }
> = {
  page: { label: 'Page', bar: 'ink', minimap: '#000000' },
  api: { label: 'API', bar: 'gray', minimap: '#666666' },
  service: { label: 'Service', bar: 'striped', minimap: '#999999' },
  module: { label: 'Module', bar: 'gray', minimap: '#cccccc' },
  file: { label: 'File', bar: null, minimap: '#bbbbbb' },
  external: { label: 'External', bar: null, minimap: '#dddddd' },
}

const BAR_FILL: Record<'ink' | 'gray', string> = { ink: '#000000', gray: '#666666' }

export interface CartoNodeData extends Record<string, unknown> {
  nodeId: string
  label: string
  sub?: string
  kind: NodeKind
  runtime?: string
  /** 左墨條:hex 色(curation 自訂)、'striped'、或 null(無條) */
  bar: string | null
  minimapColor: string
  pinned: boolean
  hidden: boolean
  flash: boolean
  unresolved: boolean
  groupLabel?: string
}

export type CartoFlowNode = Node<CartoNodeData, 'carto'>

interface BuildParams {
  graph: ScanGraph
  map: CartoMapFile
  positionOf: (id: string) => XY
  showExternal: boolean
  showHidden: boolean
  highlightIds: Set<string> | null
  flashIds: Set<string>
}

const ARROW = (color: string) => ({
  type: MarkerType.ArrowClosed,
  color,
  width: 14,
  height: 14,
})

/** ScanGraph + 策展 map → React Flow 的 nodes/edges */
export function buildFlow(params: BuildParams): { nodes: CartoFlowNode[]; edges: Edge[] } {
  const { graph, map, positionOf, showExternal, showHidden, highlightIds, flashIds } = params

  const visible = new Set<string>()
  const nodes: CartoFlowNode[] = []

  for (const n of graph.nodes) {
    const curation = map.nodes[n.id]
    if (curation?.hidden && !showHidden) continue
    if (n.kind === 'external' && n.id !== UNRESOLVED_NODE_ID && !showExternal) continue
    visible.add(n.id)

    const group = curation?.groupId ? map.groups[curation.groupId] : undefined
    const dimmed = highlightIds !== null && !highlightIds.has(n.id)
    const meta = KIND_META[n.kind]
    const customColor = curation?.color ?? group?.color
    const bar = customColor ?? (meta.bar === 'striped' ? 'striped' : meta.bar ? BAR_FILL[meta.bar] : null)

    nodes.push({
      id: n.id,
      type: 'carto',
      position: positionOf(n.id),
      className: dimmed ? 'carto-dimmed' : undefined,
      data: {
        nodeId: n.id,
        label: curation?.label ?? n.label,
        sub: n.kind === 'page' || n.kind === 'api' ? n.filePath : n.filePath !== n.label ? n.filePath : undefined,
        kind: n.kind,
        runtime: n.runtime,
        bar,
        minimapColor: customColor ?? meta.minimap,
        pinned: curation?.pinned ?? false,
        hidden: curation?.hidden ?? false,
        flash: flashIds.has(n.id),
        unresolved: n.id === UNRESOLVED_NODE_ID,
        groupLabel: group?.label,
      },
    })
  }

  const edges: Edge[] = []

  for (const e of graph.edges) {
    if (!visible.has(e.source) || !visible.has(e.target)) continue
    const dimmed = highlightIds !== null && !(highlightIds.has(e.source) && highlightIds.has(e.target))

    // 明度階梯:fetch(資料流)最重、service-call 次之、import 最輕;紅 = 未解析
    const color = !e.resolved ? '#d71921' : e.kind === 'fetch' ? '#1a1a1a' : e.kind === 'service-call' ? '#999999' : '#cfcfcf'
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      deletable: false,
      markerEnd: e.kind === 'import' ? undefined : ARROW(color),
      style: {
        stroke: color,
        strokeWidth: e.kind === 'import' ? 1 : 1.5,
        // 未解析呼叫以虛線呈現,提示人工確認
        strokeDasharray: e.resolved ? undefined : '5 4',
        opacity: dimmed ? 0.06 : 1,
      },
    })
  }

  // 人工補的邏輯連線(annotation edges):墨色虛線,與紅色未解析區隔
  for (const a of map.annotations) {
    if (a.type !== 'edge') continue
    if (!visible.has(a.from) || !visible.has(a.to)) continue
    const dimmed = highlightIds !== null && !(highlightIds.has(a.from) && highlightIds.has(a.to))
    const color = a.style?.color ?? '#1a1a1a'
    edges.push({
      id: `ann:${a.id}`,
      source: a.from,
      target: a.to,
      label: a.label,
      deletable: true,
      markerEnd: ARROW(color),
      style: {
        stroke: color,
        strokeWidth: 1.5,
        strokeDasharray: a.style?.dashed === false ? undefined : '3 4',
        opacity: dimmed ? 0.06 : 1,
      },
      labelStyle: {
        fill: '#1a1a1a',
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        letterSpacing: '0.04em',
      },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 1, stroke: '#cccccc', strokeWidth: 1 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 2,
    })
  }

  return { nodes, edges }
}
