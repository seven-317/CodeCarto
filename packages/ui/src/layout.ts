import ELK from 'elkjs/lib/elk.bundled.js'
import type { ScanGraph } from '@codecarto/shared'

export interface XY {
  x: number
  y: number
}

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 56

const elk = new ELK()

async function layoutWith(graph: ScanGraph, strategy: string): Promise<Record<string, XY>> {
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '48',
      'elk.layered.nodePlacement.strategy': strategy,
    },
    children: graph.nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: graph.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })

  const positions: Record<string, XY> = {}
  for (const child of result.children ?? []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 }
  }
  return positions
}

/** elkjs 層級式初始佈局:Page → API → Service 由左至右 */
export async function computeAutoLayout(graph: ScanGraph): Promise<Record<string, XY>> {
  try {
    return await layoutWith(graph, 'NETWORK_SIMPLEX')
  } catch {
    // NETWORK_SIMPLEX 是遞迴實作,數百節點的密圖會 Maximum call stack
    // (elkjs 已知限制)— 退回迭代式的 BRANDES_KOEPF
    return layoutWith(graph, 'BRANDES_KOEPF')
  }
}
