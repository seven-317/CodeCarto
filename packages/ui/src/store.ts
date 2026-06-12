import { create } from 'zustand'
import {
  emptyMapFile,
  type Annotation,
  type CartoMapFile,
  type NamedView,
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
  /** 簡報模式:隱藏 chrome、放大字體 */
  presenting: boolean
  /** 路徑導覽:沿鏈路逐段高亮;step = 目前停在的節點索引 */
  walk: { ids: string[]; step: number } | null
  /** NamedView 過濾:非 null 時只顯示集合內的節點 */
  viewNodeIds: Set<string> | null
  activeViewId: string | null

  setGraph(graph: ScanGraph): void
  setMap(map: CartoMapFile): void
  setAutoPositions(pos: Record<string, XY>): void
  setShowExternal(v: boolean): void
  setShowHidden(v: boolean): void
  select(id: string | null): void
  startConnect(id: string | null): void
  setEditing(id: string | null): void
  setTheme(theme: Theme): void
  setPresenting(v: boolean): void
  startWalk(ids: string[]): void
  stepWalk(delta: number): void
  endWalk(): void
  /** null = 回到完整地圖 */
  applyView(view: NamedView | null): void
  saveView(view: NamedView): void
  deleteView(id: string): void

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
  /** 改名遷移:把 stale id 的策展(label/color/座標)搬到新節點 */
  migrateCuration(fromId: string, toId: string): void
  /** 移除單筆 stale 策展(nodes + layout2d + 相關 annotations / views)*/
  removeCuration(id: string): void
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
    presenting: false,
    walk: null,
    viewNodeIds: null,
    activeViewId: null,

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

    setPresenting(presenting) {
      // 退出簡報時一併結束導覽;進入時收掉選單類 UI 狀態
      set({ presenting, walk: null, editingId: null, connectFrom: null })
    },

    startWalk(ids) {
      if (ids.length === 0) return
      set({ walk: { ids, step: 0 }, selectedId: null, highlightIds: null })
    },
    stepWalk(delta) {
      const { walk } = get()
      if (!walk) return
      const step = Math.min(walk.ids.length - 1, Math.max(0, walk.step + delta))
      set({ walk: { ...walk, step } })
    },
    endWalk() {
      set({ walk: null })
    },

    applyView(view) {
      if (!view) {
        set({ viewNodeIds: null, activeViewId: null })
        return
      }
      set({
        viewNodeIds: view.nodeIds.length > 0 ? new Set(view.nodeIds) : null,
        activeViewId: view.id,
        selectedId: null,
        highlightIds: null,
        walk: null,
      })
    },
    saveView(view) {
      mutateMap((map) => ({
        ...map,
        views: [...map.views.filter((v) => v.id !== view.id), view],
      }))
      set({ activeViewId: view.id, viewNodeIds: view.nodeIds.length > 0 ? new Set(view.nodeIds) : null })
    },
    deleteView(id) {
      mutateMap((map) => ({ ...map, views: map.views.filter((v) => v.id !== id) }))
      if (get().activeViewId === id) set({ activeViewId: null, viewNodeIds: null })
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

    migrateCuration(fromId, toId) {
      mutateMap((map) => {
        const { [fromId]: moved, ...restNodes } = map.nodes
        const { [fromId]: pos, ...restLayout } = map.layout2d
        return {
          ...map,
          // 新節點已有的策展優先,搬過來的補空缺
          nodes: moved ? { ...restNodes, [toId]: { ...moved, ...map.nodes[toId] } } : map.nodes,
          layout2d: pos && !map.layout2d[toId] ? { ...restLayout, [toId]: pos } : restLayout,
          annotations: map.annotations.map((a) =>
            a.type === 'edge'
              ? { ...a, from: a.from === fromId ? toId : a.from, to: a.to === fromId ? toId : a.to }
              : a,
          ),
          views: map.views.map((v) => ({
            ...v,
            nodeIds: v.nodeIds.map((id) => (id === fromId ? toId : id)),
          })),
        }
      })
    },

    removeCuration(id) {
      mutateMap((map) => {
        const { [id]: _n, ...nodes } = map.nodes
        const { [id]: _p, ...layout2d } = map.layout2d
        return {
          ...map,
          nodes,
          layout2d,
          annotations: map.annotations.filter(
            (a) => a.type !== 'edge' || (a.from !== id && a.to !== id),
          ),
          views: map.views.map((v) => ({ ...v, nodeIds: v.nodeIds.filter((n) => n !== id) })),
        }
      })
    },
  }
})

// e2e 測試與除錯句柄
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__cartoStore = useCartoStore
  applyTheme(useCartoStore.getState().theme)
}

/** 點擊節點 → BFS 找出完整上下游鏈路 */
export function chainOf(graph: ScanGraph, start: string): Set<string> {
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
