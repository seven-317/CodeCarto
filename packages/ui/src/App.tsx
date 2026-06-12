import { useCallback, useEffect, useMemo, useState } from 'react'
import {
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
  type Node,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import type { NodeKind } from '@codecarto/shared'
import { fetchGraph, fetchMap, subscribeGraph } from './api'
import { computeAutoLayout, NODE_HEIGHT, NODE_WIDTH, type XY } from './layout'
import { useCartoStore } from './store'
import { PALETTES } from './theme'
import { buildFlow, KIND_META, type CartoNodeData } from './flow/buildFlow'
import { CartoNode } from './flow/CartoNode'

const nodeTypes = { carto: CartoNode }

/** 策展色盤:墨、灰 + 三個狀態色。色彩是事件,不是預設。 */
const COLOR_SWATCHES = ['#000000', '#666666', '#d71921', '#4a9e5c', '#d4a843']

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
    setTheme,
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
  const [query, setQuery] = useState('')
  const flow = useReactFlow()

  // e2e 測試與除錯句柄
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__cartoFlow = flow
  }, [flow])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchGraph(), fetchMap()])
      .then(async ([g, m]) => {
        // 佈局算完才掛 graph,首次渲染就有定位,fitView 才能正確取景
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

  // Esc 取消手動連線 / 高亮
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        startConnect(null)
        select(null)
        setMenu(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [startConnect, select])

  const positionOf = useCallback(
    (id: string): XY => map.layout2d[id] ?? autoPositions[id] ?? { x: 0, y: 0 },
    [map.layout2d, autoPositions],
  )

  const palette = PALETTES[theme]

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] }
    return buildFlow({ graph, map, positionOf, showExternal, showHidden, highlightIds, flashIds, theme })
  }, [graph, map, positionOf, showExternal, showHidden, highlightIds, flashIds, theme])

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
    // 只拍 viewport 圖層(節點+連線),對它套「框住全圖」的 transform,
    // 與當前畫面的縮放/平移無關 — 輸出永遠是完整地圖
    const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!el) return
    // 手動算邊界:getNodesBounds 在節點缺 measured 尺寸時會當成 0,導致右/下緣被裁
    const ns = flow.getNodes()
    if (ns.length === 0) return
    const minX = Math.min(...ns.map((n) => n.position.x))
    const minY = Math.min(...ns.map((n) => n.position.y))
    const maxX = Math.max(...ns.map((n) => n.position.x + (n.measured?.width ?? NODE_WIDTH)))
    const maxY = Math.max(...ns.map((n) => n.position.y + (n.measured?.height ?? NODE_HEIGHT)))
    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    const PADDING = 48
    const width = Math.ceil(bounds.width) + PADDING * 2
    const height = Math.ceil(bounds.height) + PADDING * 2
    const viewport = getViewportForBounds(bounds, width, height, 1, 1, 0)
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

  // 載入畫面:唯一的 Doto dot-matrix 時刻
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
    <div className="h-full" onClick={() => setMenu(null)}>
      <ReactFlow<Node<CartoNodeData>, Edge>
        nodes={nodes as Node<CartoNodeData>[]}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.05}
        deleteKeyCode={['Backspace', 'Delete']}
        nodesConnectable={false}
        zoomOnDoubleClick={false}
        onNodeDoubleClick={(_, node) => useCartoStore.getState().setEditing(node.id)}
        onNodeClick={(_, node) => select(node.id)}
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
        {/* dot-matrix 紙面 */}
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

        {/* 工具列(tertiary:推到邊緣,mono caps)。
            單一全寬 panel + flex-wrap:窄螢幕兩張卡換行堆疊,而非絕對定位互相重疊 */}
        <Panel position="top-left" style={{ width: 'calc(100% - 30px)', pointerEvents: 'none' }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="nd-card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5" style={{ pointerEvents: 'auto' }}>
            <span
              className="nd-mono font-bold uppercase"
              style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--text-display)' }}
            >
              Codecarto
            </span>
            <div className="relative">
              <input
                className="nd-input w-36 md:w-60"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches[0]) flyTo(matches[0].id)
                }}
                placeholder="Search"
              />
              {matches.length > 0 && (
                <div
                  className="nd-card absolute top-full mt-2 w-72 max-w-[80vw] overflow-hidden z-50"
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
              {saveState === 'error' ? '[ERROR]' : saveState === 'saving' ? '[SAVING...]' : '[SAVED]'}
            </span>
          </div>

          {/* 視圖選項 */}
          <div className="nd-card flex flex-wrap items-center gap-2.5 px-3 py-2" style={{ pointerEvents: 'auto' }}>
            <div className="nd-seg">
              <button data-active={theme === 'light'} onClick={() => setTheme('light')}>
                Light
              </button>
              <button data-active={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>
            <button className="nd-chip" data-active={showExternal} onClick={() => setShowExternal(!showExternal)}>
              Externals
            </button>
            <button className="nd-chip" data-active={showHidden} onClick={() => setShowHidden(!showHidden)}>
              Hidden
            </button>
            <button
              className="nd-btn"
              style={{ padding: '6px 14px' }}
              onClick={() => {
                if (confirm('Reset manual layout? Pinned nodes stay.')) resetLayout()
              }}
            >
              Relayout
            </button>
            <button className="nd-btn nd-btn-primary" style={{ padding: '6px 14px' }} onClick={exportPng}>
              Export PNG
            </button>
          </div>
          </div>
        </Panel>

        {/* 圖例:儀表面板 */}
        <Panel position="bottom-left">
          <div className="nd-card px-4 py-3" style={{ minWidth: 168 }}>
            {(Object.keys(KIND_META) as NodeKind[])
              .filter((k) => (counts.get(k) ?? 0) > 0)
              .map((k) => (
                <div key={k} className="flex items-center gap-2.5 py-[3px]">
                  <LegendMarker kind={k} />
                  <span className="nd-label" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    {KIND_META[k].label}
                  </span>
                  <span className="nd-mono ml-auto" style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {counts.get(k)}
                  </span>
                </div>
              ))}
            <div
              className="flex items-center gap-2.5 mt-2 pt-2"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <span className="w-4 border-t border-dashed" style={{ borderColor: 'var(--accent)' }} />
              <span className="nd-label" style={{ fontSize: 10, color: 'var(--accent)' }}>
                Unresolved
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>

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

      {/* 右鍵選單 */}
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
      className="nd-card fixed p-1.5 w-52 z-50"
      style={{ left: menu.x, top: menu.y }}
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
      <div className="flex items-center gap-2 px-3 py-2">
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
  )
}
