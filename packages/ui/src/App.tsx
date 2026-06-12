import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  getViewportForBounds,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import type { NodeKind } from '@codecarto/shared'
import { fetchGraph, fetchMap, IS_DEMO, subscribeGraph } from './api'
import { buildSelfContainedHtml, downloadText, graphToSvg } from './export'
import { computeAutoLayout, NODE_HEIGHT, NODE_WIDTH, type XY } from './layout'
import { chainOf, useCartoStore } from './store'
import { PALETTES } from './theme'
import { buildFlow, KIND_META, type CartoFlowNode, type CartoNodeData } from './flow/buildFlow'
import { CartoEdge } from './flow/CartoEdge'
import { CartoNode } from './flow/CartoNode'

const nodeTypes = { carto: CartoNode }
const edgeTypes = { carto: CartoEdge }

/** 策展色盤:墨、灰 + 三個狀態色。色彩是事件,不是預設。 */
const COLOR_SWATCHES = ['#000000', '#666666', '#d71921', '#4a9e5c', '#d4a843']

/** 節點數超過此值啟用 viewport culling 與低 zoom LOD */
const VIRTUALIZE_AT = 150
/** zoom 低於此值時 9–10px 微型文字已不可讀,直接停止繪製 */
const LOD_ZOOM = 0.45

interface MenuState {
  x: number
  y: number
  nodeId: string
}

export default function App() {
  return (
    <ReactFlowProvider>
      <CartoApp />
    </ReactFlowProvider>
  )
}

function CartoApp() {
  const {
    graph,
    map,
    autoPositions,
    showExternal,
    showHidden,
    highlightIds,
    flashIds,
    connectFrom,
    saveState,
    theme,
    presenting,
    walk,
    viewNodeIds,
    activeViewId,
    setTheme,
    setPresenting,
    startWalk,
    stepWalk,
    applyView,
    saveView,
    deleteView,
    migrateCuration,
    removeCuration,
    setGraph,
    setMap,
    setAutoPositions,
    setShowExternal,
    setShowHidden,
    select,
    startConnect,
    moveNode,
    removeAnnotation,
    resetLayout,
  } = useCartoStore()

  const [error, setError] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [openMenu, setOpenMenu] = useState<'views' | 'export' | 'stale' | null>(null)
  const [query, setQuery] = useState('')
  /** 低 zoom LOD:微型文字停止繪製(只在大圖時啟用) */
  const [farZoom, setFarZoom] = useState(false)
  /** PNG 匯出中:暫停 culling,讓畫面外節點也掛回 DOM */
  const [exporting, setExporting] = useState(false)
  const flow = useReactFlow()

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__cartoFlow = flow
  }, [flow])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchGraph(), fetchMap()])
      .then(async ([g, m]) => {
        const positions = await computeAutoLayout(g)
        if (cancelled) return
        setMap(m)
        setAutoPositions(positions)
        setGraph(g)
      })
      .catch((err: Error) => setError(err.message))

    const unsubscribe = subscribeGraph(async (g) => {
      const positions = await computeAutoLayout(g)
      setAutoPositions(positions)
      setGraph(g)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [setGraph, setMap, setAutoPositions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useCartoStore.getState()
      if (e.key === 'Escape') {
        if (s.walk) s.endWalk()
        else if (s.presenting) s.setPresenting(false)
        else {
          startConnect(null)
          select(null)
          setMenu(null)
          setOpenMenu(null)
        }
        return
      }
      if (s.walk && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === ' ')) {
        e.preventDefault()
        s.stepWalk(e.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startConnect, select])

  const positionOf = useCallback(
    (id: string): XY => map.layout2d[id] ?? autoPositions[id] ?? { x: 0, y: 0 },
    [map.layout2d, autoPositions],
  )

  useEffect(() => {
    const id = walk?.ids[walk.step]
    if (!id) return
    const pos = positionOf(id)
    flow.setCenter(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2, { zoom: 1.15, duration: 500 })
  }, [walk, positionOf, flow])

  const palette = PALETTES[theme]

  const { nodes: builtNodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [] as CartoFlowNode[], edges: [] as Edge[] }
    const effectiveHighlight = walk ? new Set(walk.ids.slice(0, walk.step + 1)) : highlightIds
    return buildFlow({
      graph,
      map,
      positionOf,
      showExternal,
      showHidden,
      highlightIds: effectiveHighlight,
      flashIds,
      theme,
      viewFilter: viewNodeIds,
    })
  }, [graph, map, positionOf, showExternal, showHidden, highlightIds, flashIds, theme, walk, viewNodeIds])

  // 受控 nodes:拖曳中的位置變更即時回寫 state,節點跟著滑鼠走;
  // 放開時 onNodeDragStop 才寫進 map,builtNodes 重建後同步回來(座標相同,無跳動)
  const [nodes, setNodes] = useState<CartoFlowNode[]>([])
  useEffect(() => setNodes(builtNodes), [builtNodes])
  const onNodesChange = useCallback(
    (changes: NodeChange<CartoFlowNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )

  const staleIds = useMemo(() => {
    if (!graph) return []
    const live = new Set(graph.nodes.map((n) => n.id))
    return [...new Set([...Object.keys(map.nodes), ...Object.keys(map.layout2d)])].filter(
      (id) => !live.has(id),
    )
  }, [graph, map.nodes, map.layout2d])

  const migrationTarget = useCallback(
    (staleId: string): string | undefined => {
      if (!graph) return undefined
      const base = staleId.split('/').pop()
      if (!base) return undefined
      const kindOf = (id: string) => (/^[a-z]+:/.test(id) ? id.split(':')[0] : 'file')
      return graph.nodes.find(
        (n) => n.id !== staleId && kindOf(n.id) === kindOf(staleId) && n.id.split('/').pop() === base,
      )?.id
    },
    [graph],
  )

  // 大圖虛擬化:culling 與 LOD 都只在超過門檻時啟用,小圖維持零成本
  const bigGraph = nodes.length > VIRTUALIZE_AT

  const counts = useMemo(() => {
    const c = new Map<NodeKind, number>()
    for (const n of graph?.nodes ?? []) c.set(n.kind, (c.get(n.kind) ?? 0) + 1)
    return c
  }, [graph])

  const matches = useMemo(() => {
    if (!graph || query.trim().length < 2) return []
    const q = query.toLowerCase()
    return graph.nodes
      .filter((n) => {
        const label = map.nodes[n.id]?.label ?? n.label
        return (
          label.toLowerCase().includes(q) ||
          n.filePath?.toLowerCase().includes(q) ||
          n.route?.toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [graph, map.nodes, query])

  const flyTo = (id: string) => {
    const pos = positionOf(id)
    flow.setCenter(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2, { zoom: 1.3, duration: 400 })
    select(id)
    setQuery('')
  }

  const exportPng = async () => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!el) return
    const ns = flow.getNodes()
    if (ns.length === 0) return
    // 匯出中:關閉封包動畫點;大圖另外暫停 culling 讓畫面外節點掛回 DOM
    setExporting(true)
    await new Promise((r) => setTimeout(r, bigGraph ? 150 : 50))
    const minX = Math.min(...ns.map((n) => n.position.x))
    const minY = Math.min(...ns.map((n) => n.position.y))
    const maxX = Math.max(...ns.map((n) => n.position.x + (n.measured?.width ?? NODE_WIDTH)))
    const maxY = Math.max(...ns.map((n) => n.position.y + (n.measured?.height ?? NODE_HEIGHT)))
    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    const PADDING = 48
    const width = Math.ceil(bounds.width) + PADDING * 2
    const height = Math.ceil(bounds.height) + PADDING * 2
    const viewport = getViewportForBounds(bounds, width, height, 1, 1, 0)
    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: palette.page,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'codecarto.png'
      a.click()
    } finally {
      setExporting(false)
    }
  }

  const exportSvg = () => downloadText('codecarto.svg', graphToSvg(nodes as CartoFlowNode[], edges, theme), 'image/svg+xml')

  const exportHtml = () => {
    const svg = graphToSvg(nodes as CartoFlowNode[], edges, theme)
    const title = graph?.root.split('/').pop() ?? 'Architecture Map'
    downloadText('codecarto.html', buildSelfContainedHtml({ svg, edges, title, theme }), 'text/html')
  }

  const saveCurrentView = () => {
    const label = prompt('View name:')
    if (!label?.trim()) return
    const nodeIds = viewNodeIds ? [...viewNodeIds] : highlightIds ? [...highlightIds] : []
    saveView({
      id: `view-${Date.now().toString(36)}`,
      label: label.trim(),
      nodeIds,
      viewport: flow.getViewport(),
    })
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="nd-label" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          [<span style={{ color: 'var(--accent)' }}>ERROR</span>] SERVER UNREACHABLE
        </div>
        <div className="nd-mono" style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
          {error} — run `npx codecarto` first
        </div>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: '-0.02em',
            color: 'var(--text-display)',
          }}
        >
          CODECARTO
        </div>
        <div className="nd-label" style={{ color: 'var(--text-secondary)' }}>
          [SCANNING SOURCE...]
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full"
      data-present={presenting || undefined}
      data-zoom-far={(bigGraph && farZoom && !exporting) || undefined}
      data-exporting={exporting || undefined}
      onClick={() => {
        setMenu(null)
        setOpenMenu(null)
      }}
    >
      <ReactFlow<CartoFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.05}
        deleteKeyCode={['Backspace', 'Delete']}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        onlyRenderVisibleElements={bigGraph && !exporting}
        onMove={(_, vp) => {
          const far = vp.zoom < LOD_ZOOM
          if (far !== farZoom) setFarZoom(far)
        }}
        onNodeDoubleClick={(_, node) => useCartoStore.getState().setEditing(node.id)}
        onNodeClick={(_, node) => {
          if (presenting && graph) {
            const chain = chainOf(graph, node.id)
            const visibleIds = new Set(nodes.map((n) => n.id))
            const ordered = [...chain]
              .filter((id) => visibleIds.has(id))
              .sort((a, b) => {
                const pa = positionOf(a)
                const pb = positionOf(b)
                return pa.x - pb.x || pa.y - pb.y
              })
            startWalk(ordered)
            return
          }
          select(node.id)
        }}
        onPaneClick={() => {
          select(null)
          setMenu(null)
        }}
        onNodeDragStop={(_, node) => moveNode(node.id, node.position)}
        onNodeContextMenu={(e, node) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
        }}
        onEdgesDelete={(deleted) => {
          for (const e of deleted) {
            if (e.id.startsWith('ann:')) removeAnnotation(e.id.slice(4))
          }
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={palette.dots} />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(n) => (n.data as CartoNodeData).minimapColor}
          nodeStrokeColor={palette.borderVisible}
          maskColor={palette.mask}
          style={{ background: palette.surface }}
        />

        {/* 工具列:單一卡片,內部 pipe 分隔 */}
        <Panel position="top-left" style={{ width: 'calc(100% - 30px)', pointerEvents: 'none' }}>
          <div
            className="nd-card flex flex-wrap items-stretch w-full"
            style={{ pointerEvents: 'auto' }}
          >
            {/* 左區:品牌 + 搜尋 + 儲存狀態 */}
            <div className="nd-toolbar-left">
              {/* 品牌名稱 — dot-matrix 顯示字體,全畫面唯一的 display moment */}
              <div
                className="px-4 flex items-center shrink-0"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  letterSpacing: '0.08em',
                  color: 'var(--text-display)',
                  borderRight: '1px solid var(--border)',
                }}
              >
                CODECARTO
              </div>

              {/* 搜尋 */}
              <div
                className="flex items-center px-3 relative flex-1 min-w-0"
                style={{ borderRight: '1px solid var(--border)' }}
              >
                <input
                  className="nd-input w-full"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && matches[0]) flyTo(matches[0].id)
                  }}
                  placeholder="Search"
                />
                {matches.length > 0 && (
                  <div
                    className="nd-card absolute top-full left-0 mt-1 w-72 max-w-[80vw] overflow-hidden z-50"
                    style={{ borderRadius: 8 }}
                  >
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        className="flex items-baseline gap-3 w-full text-left px-3 py-2 hover:bg-[var(--surface-raised)]"
                        onClick={() => flyTo(m.id)}
                      >
                        <span
                          className="nd-mono uppercase shrink-0 w-14"
                          style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-disabled)' }}
                        >
                          {KIND_META[m.kind].label}
                        </span>
                        <span className="truncate" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {map.nodes[m.id]?.label ?? m.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 儲存狀態 */}
              <div className="flex items-center px-3 shrink-0">
                <span
                  className="nd-label"
                  style={{
                    fontSize: 10,
                    color:
                      saveState === 'error'
                        ? 'var(--accent)'
                        : saveState === 'saving'
                          ? 'var(--warning)'
                          : 'var(--text-disabled)',
                  }}
                >
                  {IS_DEMO
                    ? '[DEMO]'
                    : saveState === 'error'
                      ? '[ERROR]'
                      : saveState === 'saving'
                        ? '[SAVING...]'
                        : '[SAVED]'}
                </span>
              </div>
            </div>

            {/* 右區:所有控制(桌面版同行右側,手機版換到第二排) */}
            <div className="nd-toolbar-right">
              {/* 主題切換 */}
              <div className="nd-seg shrink-0">
                <button data-active={theme === 'light'} onClick={() => setTheme('light')}>
                  Light
                </button>
                <button data-active={theme === 'dark'} onClick={() => setTheme('dark')}>
                  Dark
                </button>
              </div>

              <div className="carto-divider" />

              <button className="nd-chip" data-active={showExternal} onClick={() => setShowExternal(!showExternal)}>
                Externals
              </button>
              <button className="nd-chip" data-active={showHidden} onClick={() => setShowHidden(!showHidden)}>
                Hidden
              </button>

              {/* Stale 策展警告 */}
              {staleIds.length > 0 && (
                <div className="relative">
                  <button
                    className="nd-chip"
                    style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenu(openMenu === 'stale' ? null : 'stale')
                    }}
                  >
                    Stale {staleIds.length}
                  </button>
                  {openMenu === 'stale' && (
                    <div
                      className="nd-card absolute right-0 top-full mt-2 w-80 overflow-hidden z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="nd-label px-3 py-2.5"
                        style={{ fontSize: 9, color: 'var(--text-disabled)', borderBottom: '1px solid var(--border)' }}
                      >
                        Curation without a matching node
                      </div>
                      {staleIds.map((id) => {
                        const target = migrationTarget(id)
                        return (
                          <div key={id} className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className="nd-mono truncate" style={{ fontSize: 10, color: 'var(--text-primary)' }} title={id}>
                              {id}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {target && (
                                <button
                                  className="nd-chip"
                                  style={{ fontSize: 9 }}
                                  title={`Migrate curation to ${target}`}
                                  onClick={() => migrateCuration(id, target)}
                                >
                                  → {target.split('/').pop()}
                                </button>
                              )}
                              <button
                                className="nd-chip ml-auto"
                                style={{ fontSize: 9, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                                onClick={() => removeCuration(id)}
                              >
                                Drop
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      <button
                        className="nd-menu-item"
                        style={{ color: 'var(--accent)' }}
                        onClick={() => {
                          staleIds.forEach((id) => removeCuration(id))
                          setOpenMenu(null)
                        }}
                      >
                        Drop all
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="carto-divider" />

              {/* NamedView */}
              <div className="relative">
                <button
                  className="nd-chip"
                  data-active={!!activeViewId || openMenu === 'views'}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenu(openMenu === 'views' ? null : 'views')
                  }}
                >
                  Views
                </button>
                {openMenu === 'views' && (
                  <div
                    className="nd-card absolute right-0 top-full mt-2 w-64 overflow-hidden z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="nd-menu-item"
                      onClick={() => {
                        saveCurrentView()
                        setOpenMenu(null)
                      }}
                    >
                      Save current...
                    </button>
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        className="nd-menu-item"
                        data-active-item={!activeViewId || undefined}
                        onClick={() => {
                          applyView(null)
                          flow.fitView({ duration: 400 })
                          setOpenMenu(null)
                        }}
                      >
                        Full map
                      </button>
                      {map.views.map((v) => (
                        <div key={v.id} className="flex items-center">
                          <button
                            className="nd-menu-item flex-1 truncate"
                            data-active-item={activeViewId === v.id || undefined}
                            onClick={() => {
                              applyView(v)
                              if (v.viewport) flow.setViewport(v.viewport, { duration: 400 })
                              else setTimeout(() => flow.fitView({ duration: 400 }), 50)
                              setOpenMenu(null)
                            }}
                          >
                            {v.label}
                          </button>
                          <button
                            className="nd-mono px-3 py-2 cursor-pointer"
                            style={{ fontSize: 10, color: 'var(--text-disabled)' }}
                            title="Delete view"
                            onClick={() => deleteView(v.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                className="nd-btn"
                style={{ padding: '5px 12px' }}
                onClick={() => {
                  if (confirm('Reset manual layout? Pinned nodes stay.')) resetLayout()
                }}
              >
                Relayout
              </button>

              <button
                className="nd-btn"
                style={{ padding: '5px 12px' }}
                onClick={() => setPresenting(true)}
              >
                Present
              </button>

              {/* 匯出 */}
              <div className="relative">
                <button
                  className="nd-btn nd-btn-primary"
                  style={{ padding: '5px 12px' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenu(openMenu === 'export' ? null : 'export')
                  }}
                >
                  Export
                </button>
                {openMenu === 'export' && (
                  <div
                    className="nd-card absolute right-0 top-full mt-2 w-52 overflow-hidden z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="nd-menu-item"
                      onClick={() => {
                        void exportPng()
                        setOpenMenu(null)
                      }}
                    >
                      PNG — bitmap 2×
                    </button>
                    <button
                      className="nd-menu-item"
                      onClick={() => {
                        exportSvg()
                        setOpenMenu(null)
                      }}
                    >
                      SVG — vector
                    </button>
                    <button
                      className="nd-menu-item"
                      onClick={() => {
                        exportHtml()
                        setOpenMenu(null)
                      }}
                    >
                      HTML — interactive
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        {/* 圖例:儀表面板 */}
        <Panel position="bottom-left">
          <div className="nd-card overflow-hidden" style={{ minWidth: 160 }}>
            <div
              className="nd-label px-3 py-2"
              style={{ fontSize: 9, color: 'var(--text-disabled)', borderBottom: '1px solid var(--border)' }}
            >
              Legend
            </div>
            <div className="px-3 py-2">
              {(Object.keys(KIND_META) as NodeKind[])
                .filter((k) => (counts.get(k) ?? 0) > 0)
                .map((k) => (
                  <div key={k} className="flex items-center gap-2.5 py-[3px]">
                    <LegendMarker kind={k} />
                    <span className="nd-label flex-1" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      {KIND_META[k].label}
                    </span>
                    <span
                      className="nd-mono"
                      style={{ fontSize: 13, color: 'var(--text-display)', fontWeight: 700 }}
                    >
                      {counts.get(k)}
                    </span>
                  </div>
                ))}
              <div
                className="flex items-center gap-2.5 mt-1.5 pt-1.5"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="w-4 border-t border-dashed" style={{ borderColor: 'var(--accent)' }} />
                <span className="nd-label flex-1" style={{ fontSize: 10, color: 'var(--accent)' }}>
                  Unresolved
                </span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* 簡報模式 HUD */}
      {presenting && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-visible)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            overflow: 'hidden',
          }}
        >
          {walk ? (
            <>
              <span
                className="nd-mono"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-display)',
                  padding: '9px 16px',
                  borderRight: '1px solid var(--border)',
                  letterSpacing: '0.04em',
                }}
              >
                {walk.step + 1} / {walk.ids.length}
              </span>
              <span
                className="nd-label"
                style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '9px 16px' }}
              >
                ← → step · esc exit
              </span>
            </>
          ) : (
            <span
              className="nd-label"
              style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '9px 20px' }}
            >
              Click a node to walk its path · esc to exit
            </span>
          )}
        </div>
      )}

      {/* 手動連線提示 */}
      {connectFrom && (
        <div
          className="nd-label fixed top-5 left-1/2 -translate-x-1/2 z-50"
          style={{
            background: 'var(--text-display)',
            color: 'var(--surface)',
            padding: '10px 20px',
            borderRadius: 999,
          }}
        >
          Select target node — ESC to cancel
        </div>
      )}

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  )
}

function LegendMarker({ kind }: { kind: NodeKind }) {
  const meta = KIND_META[kind]
  if (meta.bar === 'striped') return <span className="nd-bar-striped w-1 h-3.5 shrink-0" />
  if (meta.bar)
    return (
      <span
        className="w-1 h-3.5 shrink-0"
        style={{ background: meta.bar === 'ink' ? 'var(--text-display)' : 'var(--text-secondary)' }}
      />
    )
  return (
    <span
      className="w-2.5 h-2.5 shrink-0"
      style={{
        border: `1px ${kind === 'external' ? 'dashed' : 'solid'} var(--border-visible)`,
        background: 'var(--surface)',
      }}
    />
  )
}

function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const { map, renameNode, setNodeColor, toggleNodeHidden, togglePinned, assignGroup, startConnect } =
    useCartoStore()
  const curation = map.nodes[menu.nodeId]

  return (
    <div
      className="nd-card fixed overflow-hidden z-50"
      style={{ left: menu.x, top: menu.y, width: 208 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="nd-menu-item"
        onClick={() => {
          const next = prompt('Rename (empty = restore auto label):', curation?.label ?? '')
          if (next !== null) renameNode(menu.nodeId, next)
          onClose()
        }}
      >
        Rename...
      </button>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            className="w-3.5 h-3.5 cursor-pointer"
            style={{ background: c, borderRadius: 2 }}
            onClick={() => {
              setNodeColor(menu.nodeId, c)
              onClose()
            }}
          />
        ))}
        <button
          className="nd-mono ml-auto cursor-pointer"
          style={{ fontSize: 10, color: 'var(--text-disabled)' }}
          title="Clear color"
          onClick={() => {
            setNodeColor(menu.nodeId, null)
            onClose()
          }}
        >
          CLR
        </button>
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button
          className="nd-menu-item"
          onClick={() => {
            toggleNodeHidden(menu.nodeId)
            onClose()
          }}
        >
          {curation?.hidden ? 'Unhide' : 'Hide'}
        </button>
        <button
          className="nd-menu-item"
          onClick={() => {
            togglePinned(menu.nodeId)
            onClose()
          }}
        >
          {curation?.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          className="nd-menu-item"
          onClick={() => {
            const name = prompt('Group name (empty = remove from group):', '')
            if (name !== null) assignGroup(menu.nodeId, name.trim() || null)
            onClose()
          }}
        >
          Group...
        </button>
        <button
          className="nd-menu-item"
          onClick={() => {
            startConnect(menu.nodeId)
            onClose()
          }}
        >
          Connect to...
        </button>
      </div>
    </div>
  )
}
