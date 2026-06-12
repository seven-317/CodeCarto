import { create } from 'zustand'
import {
  emptyMapFile,
  type Annotation,
  type CartoMapFile,
  type ScanGraph,
} from '@codecarto/shared'
import { postMap } from './api'
import type { XY } from './layout'
import { applyTheme, initialTheme, type Theme } from './theme'

export type SaveState = 'saved' | 'saving' | 'error'

interface CartoState {
  graph: ScanGraph | null
  map: CartoMapFile
  /** elk 自動佈局結果;layout2d 沒有的節點用這裡的座標 */
  autoPositions: Record<string, XY>
  showExternal: boolean
  showHidden: boolean
  selectedId: string | null
  /** 點擊節點後的上下游鏈路;null = 無高亮 */
  highlightIds: Set<string> | null
  /** watch mode 推送後新增的節點,做綠色閃爍 */
  flashIds: Set<string>
  /** 手動連線模式:來源節點 */
  connectFrom: string | null
  /** 正在 inline 改名的節點 */
  editingId: string | null
  saveState: SaveState
  theme: Theme

  setGraph(graph: ScanGraph): void
  setMap(map: CartoMapFile): void
  setAutoPositions(pos: Record<string, XY>): void
  setShowExternal(v: boolean): void
  setShowHidden(v: boolean): void
  select(id: string | null): void
  startConnect(id: string | null): void
  setEditing(id: string | null): void
  setTheme(theme: Theme): void

  // —— 策展操作(全部寫進 map 並 debounce 存檔)——
  renameNode(id: string, label: string): void
  setNodeColor(id: string, color: string | null): void
  toggleNodeHidden(id: string): void
  togglePinned(id: string): void
  assignGroup(id: string, groupLabel: string | null): void
  moveNode(id: string, pos: XY): void
  addManualEdge(from: string, to: string, label?: string): void
  removeAnnotation(id: string): void
  /** 清掉手動座標重跑自動佈局;釘選節點不動 */
  resetLayout(): void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useCartoStore = create<CartoState>((set, get) => {
  /** UI 操作 → debounce 後 POST /api/map */
  const mutateMap = (fn: (map: CartoMapFile) => CartoMapFile) => {
    const next = fn(get().map)
    set({ map: next })
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      set({ saveState: 'saving' })
      try {
        await postMap(get().map)
        set({ saveState: 'saved' })
      } catch {
        set({ saveState: 'error' })
      }
    }, 500)
  }

  const patchNode = (id: string, patch: Record<string, unknown>) =>
    mutateMap((map) => ({
      ...map,
      nodes: { ...map.nodes, [id]: { ...map.nodes[id], ...patch } },
    }))

  return {
    graph: null,
    map: emptyMapFile(),
    autoPositions: {},
    showExternal: false,
    showHidden: false,
    selectedId: null,
    highlightIds: null,
    flashIds: new Set(),
    connectFrom: null,
    editingId: null,
    saveState: 'saved',
    theme: initialTheme(),

    setGraph(graph) {
      const prev = get().graph
      // watch 推送:標記新增節點供閃爍
      const flashIds = prev
        ? new Set([...graph.nodes.map((n) => n.id)].filter((id) => !prev.nodes.some((n) => n.id === id)))
        : new Set<string>()
      set({ graph, flashIds })
    },
    setMap(map) {
      set({ map })
    },
    setAutoPositions(autoPositions) {
      set({ autoPositions })
    },
    setShowExternal(showExternal) {
      set({ showExternal })
    },
    setShowHidden(showHidden) {
      set({ showHidden })
    },

    select(id) {
      const { graph, connectFrom } = get()
      if (id && connectFrom && connectFrom !== id) {
        get().addManualEdge(connectFrom, id)
        set({ connectFrom: null })
        return
      }
      if (!id || !graph) {
        set({ selectedId: null, highlightIds: null })
        return
      }
      set({ selectedId: id, highlightIds: chainOf(graph, id) })
    },

    startConnect(id) {
      set({ connectFrom: id })
    },

    setEditing(id) {
      set({ editingId: id })
    },

    setTheme(theme) {
      applyTheme(theme)
      set({ theme })
    },

    renameNode(id, label) {
      patchNode(id, { label: label.trim() || undefined })
    },
    setNodeColor(id, color) {
      patchNode(id, { color: color ?? undefined })
    },
    toggleNodeHidden(id) {
      patchNode(id, { hidden: get().map.nodes[id]?.hidden ? undefined : true })
    },
    togglePinned(id) {
      patchNode(id, { pinned: get().map.nodes[id]?.pinned ? undefined : true })
    },

    assignGroup(id, groupLabel) {
      if (!groupLabel) {
        patchNode(id, { groupId: undefined })
        return
      }
      mutateMap((map) => {
        const existing = Object.entries(map.groups).find(([, g]) => g.label === groupLabel)
        const groupId = existing?.[0] ?? `group-${Date.now().toString(36)}`
        return {
          ...map,
          groups: existing ? map.groups : { ...map.groups, [groupId]: { label: groupLabel } },
          nodes: { ...map.nodes, [id]: { ...map.nodes[id], groupId } },
        }
      })
    },

    moveNode(id, pos) {
      mutateMap((map) => ({
        ...map,
        layout2d: { ...map.layout2d, [id]: { x: Math.round(pos.x), y: Math.round(pos.y) } },
      }))
    },

    addManualEdge(from, to, label) {
      const annotation: Annotation = {
        type: 'edge',
        id: `manual-${Date.now().toString(36)}`,
        from,
        to,
        label,
      }
      mutateMap((map) => ({ ...map, annotations: [...map.annotations, annotation] }))
    },

    removeAnnotation(id) {
      mutateMap((map) => ({ ...map, annotations: map.annotations.filter((a) => a.id !== id) }))
    },

    resetLayout() {
      mutateMap((map) => ({
        ...map,
        layout2d: Object.fromEntries(
          Object.entries(map.layout2d).filter(([id]) => map.nodes[id]?.pinned),
        ),
      }))
    },
  }
})

// e2e 測試與除錯句柄
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__cartoStore = useCartoStore
  applyTheme(useCartoStore.getState().theme)
}

/** 點擊節點 → BFS 找出完整上下游鏈路 */
function chainOf(graph: ScanGraph, start: string): Set<string> {
  const out = new Map<string, string[]>()
  const inn = new Map<string, string[]>()
  for (const e of graph.edges) {
    out.set(e.source, [...(out.get(e.source) ?? []), e.target])
    inn.set(e.target, [...(inn.get(e.target) ?? []), e.source])
  }
  const visited = new Set([start])
  const walk = (adj: Map<string, string[]>) => {
    const queue = [start]
    const seen = new Set([start])
    while (queue.length) {
      const cur = queue.shift()!
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          visited.add(next)
          queue.push(next)
        }
      }
    }
  }
  walk(out)
  walk(inn)
  return visited
}
