import ELK from 'elkjs/lib/elk.bundled.js'
import type { ScanGraph } from '@codecarto/shared'

export interface XY {
  x: number
  y: number
}

export const NODE_WIDTH = 200
export const NODE_HEIGHT = 56

const elk = new ELK()

/** elkjs 層級式初始佈局:Page → API → Service 由左至右 */
export async function computeAutoLayout(graph: ScanGraph): Promise<Record<string, XY>> {
  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '48',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
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
