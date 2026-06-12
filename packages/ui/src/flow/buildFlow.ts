import { MarkerType, type Edge, type Node } from '@xyflow/react'
import {
  UNRESOLVED_NODE_ID,
  type CartoMapFile,
  type NodeKind,
  type ScanGraph,
} from '@codecarto/shared'
import type { XY } from '../layout'
import { ACCENT, curatedColor, PALETTES, type Theme } from '../theme'

/**
 * 單色系統:kind 以「左墨條」的明度與圖樣區分(opacity → pattern,不靠色相)。
 * 紅色保留給未解析呼叫 — 全畫面唯一的 interrupt。
 * 'ink' / 'gray' 在元件端解析為 CSS 變數,跨模式自動切換。
 */
export const KIND_META: Record<NodeKind, { label: string; bar: 'ink' | 'gray' | 'striped' | null }> = {
  page: { label: 'Page', bar: 'ink' },
  api: { label: 'API', bar: 'gray' },
  service: { label: 'Service', bar: 'striped' },
  module: { label: 'Module', bar: 'gray' },
  file: { label: 'File', bar: null },
  external: { label: 'External', bar: null },
}

export interface CartoNodeData extends Record<string, unknown> {
  nodeId: string
  label: string
  sub?: string
  kind: NodeKind
  runtime?: string
  /** 左墨條:'ink' | 'gray' | 'striped'(CSS 變數解析)或 hex(curation 自訂,已依 theme 轉換) */
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
  theme: Theme
  /** NamedView 過濾:非 null 時只顯示集合內的節點 */
  viewFilter: Set<string> | null
}

const ARROW = (color: string) => ({
  type: MarkerType.ArrowClosed,
  color,
  width: 14,
  height: 14,
})

/** ScanGraph + 策展 map → React Flow 的 nodes/edges */
export function buildFlow(params: BuildParams): { nodes: CartoFlowNode[]; edges: Edge[] } {
  const { graph, map, positionOf, showExternal, showHidden, highlightIds, flashIds, theme, viewFilter } =
    params
  const palette = PALETTES[theme]

  const visible = new Set<string>()
  const nodes: CartoFlowNode[] = []

  for (const n of graph.nodes) {
    const curation = map.nodes[n.id]
    if (viewFilter && !viewFilter.has(n.id)) continue
    if (curation?.hidden && !showHidden) continue
    if (n.kind === 'external' && n.id !== UNRESOLVED_NODE_ID && !showExternal) continue
    visible.add(n.id)

    const group = curation?.groupId ? map.groups[curation.groupId] : undefined
    const dimmed = highlightIds !== null && !highlightIds.has(n.id)
    const customColor = curation?.color ?? group?.color

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
        bar: customColor ? curatedColor(customColor, theme) : KIND_META[n.kind].bar,
        minimapColor: customColor ? curatedColor(customColor, theme) : palette.minimap[n.kind],
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
    const color = !e.resolved ? ACCENT : e.kind === 'fetch' ? palette.ink : e.kind === 'service-call' ? palette.mid : palette.faint
    edges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'carto', // 封包動畫邊;annotation 邊有 label,維持內建型別
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
    const color = a.style?.color ? curatedColor(a.style.color, theme) : palette.ink
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
        fill: palette.ink,
        fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        letterSpacing: '0.04em',
      },
      labelBgStyle: { fill: palette.surface, fillOpacity: 1, stroke: palette.borderVisible, strokeWidth: 1 },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 2,
    })
  }

  return { nodes, edges }
}
