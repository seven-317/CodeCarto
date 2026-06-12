import type { Edge } from '@xyflow/react'
import { NODE_HEIGHT, NODE_WIDTH } from './layout'
import { PALETTES, type Theme } from './theme'
import { KIND_META, type CartoFlowNode } from './flow/buildFlow'

/**
 * 手刻 SVG 匯出:不經 DOM 截圖,向量輸出放進簡報與文件不失真。
 * 輸入直接吃 buildFlow 的結果 — 邊的顏色/虛線、節點的策展 label 都已解析完畢。
 */

const PAD = 48

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** SVG 沒有 CSS truncate,以字數近似(mono/grotesk 在此字級下約 7px/字)*/
function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

interface ExportColors {
  page: string
  surface: string
  border: string
  inkBar: string
  grayBar: string
  textPrimary: string
  textSecondary: string
  textDisabled: string
  accent: string
}

function exportColors(theme: Theme): ExportColors {
  const p = PALETTES[theme]
  return {
    page: p.page,
    surface: p.surface,
    border: p.borderVisible,
    inkBar: theme === 'dark' ? '#ffffff' : '#000000',
    grayBar: theme === 'dark' ? '#999999' : '#666666',
    textPrimary: theme === 'dark' ? '#e8e8e8' : '#1a1a1a',
    textSecondary: theme === 'dark' ? '#999999' : '#666666',
    textDisabled: theme === 'dark' ? '#666666' : '#999999',
    accent: '#d71921',
  }
}

export function graphToSvg(nodes: CartoFlowNode[], edges: Edge[], theme: Theme): string {
  const c = exportColors(theme)
  const pos = new Map(nodes.map((n) => [n.id, n.position]))

  const minX = Math.min(...nodes.map((n) => n.position.x)) - PAD
  const minY = Math.min(...nodes.map((n) => n.position.y)) - PAD
  const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_WIDTH)) + PAD
  const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_HEIGHT)) + PAD
  const width = Math.ceil(maxX - minX)
  const height = Math.ceil(maxY - minY)

  // 每種箭頭色一個 marker def
  const markerColors = new Set<string>()
  for (const e of edges) {
    if (e.markerEnd && typeof e.style?.stroke === 'string') markerColors.add(e.style.stroke)
  }
  const markerId = (color: string) => `arrow-${color.replace(/[^a-z0-9]/gi, '')}`
  const markerDefs = [...markerColors]
    .map(
      (color) =>
        `<marker id="${markerId(color)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`,
    )
    .join('\n      ')

  const edgeSvg = edges
    .map((e) => {
      const s = pos.get(e.source)
      const t = pos.get(e.target)
      if (!s || !t) return ''
      const x1 = s.x + NODE_WIDTH
      const y1 = s.y + NODE_HEIGHT / 2
      const x2 = t.x
      const y2 = t.y + NODE_HEIGHT / 2
      const dx = Math.max(40, Math.abs(x2 - x1) / 2)
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
      const stroke = typeof e.style?.stroke === 'string' ? e.style.stroke : c.border
      const dash = e.style?.strokeDasharray ? ` stroke-dasharray="${e.style.strokeDasharray}"` : ''
      const marker = e.markerEnd ? ` marker-end="url(#${markerId(stroke)})"` : ''
      const label = e.label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-family="'Space Mono', monospace" font-size="10" fill="${c.textSecondary}">${esc(String(e.label))}</text>`
        : ''
      return `<g class="edge" data-source="${esc(e.source)}" data-target="${esc(e.target)}"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${e.style?.strokeWidth ?? 1}"${dash}${marker}/>${label}</g>`
    })
    .join('\n      ')

  const nodeSvg = nodes
    .map((n) => {
      const { x, y } = n.position
      const d = n.data
      const border = d.unresolved ? c.accent : c.border
      const dashed = d.kind === 'external' ? ' stroke-dasharray="4 3"' : ''
      const kindColor = d.unresolved ? c.accent : c.textSecondary
      const barFill =
        d.bar === 'ink' ? c.inkBar : d.bar === 'gray' ? c.grayBar : d.bar === 'striped' ? 'url(#striped)' : null
      const bar = barFill ? `<rect x="${x}" y="${y}" width="3" height="${NODE_HEIGHT}" fill="${barFill}"/>` : ''
      const kindRow = `${KIND_META[d.kind].label}${d.runtime === 'client' ? '  CLIENT' : ''}`
      const sub = d.sub
        ? `<text x="${x + 12}" y="${y + 46}" font-family="'Space Mono', monospace" font-size="9" fill="${c.textDisabled}">${esc(clip(d.sub, 32))}</text>`
        : ''
      return `<g class="node" data-id="${esc(n.id)}">
        <rect x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="4" fill="${c.surface}" stroke="${border}"${dashed}/>
        ${bar}
        <text x="${x + 12}" y="${y + 16}" font-family="'Space Mono', monospace" font-size="8" letter-spacing="0.08em" fill="${kindColor}">${esc(kindRow.toUpperCase())}</text>
        <text x="${x + 12}" y="${y + 33}" font-family="'Space Grotesk', sans-serif" font-size="13" font-weight="500" fill="${c.textPrimary}">${esc(clip(d.label, 26))}</text>
        ${sub}
      </g>`
    })
    .join('\n      ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" font-family="'Space Grotesk', sans-serif">
  <defs>
      <pattern id="striped" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="2" height="5" fill="${c.textPrimary}"/></pattern>
      ${markerDefs}
  </defs>
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${c.page}"/>
  <g id="world">
      ${edgeSvg}
      ${nodeSvg}
  </g>
</svg>`
}

/**
 * 自包含 HTML:SVG + 唯讀 viewer 內嵌單一檔案,寄給甲方直接用瀏覽器開。
 * 可互動(pan / zoom / 點擊鏈路高亮)但不可編輯。
 */
export function buildSelfContainedHtml(params: {
  svg: string
  edges: Edge[]
  title: string
  theme: Theme
}): string {
  const { svg, edges, title, theme } = params
  const c = exportColors(theme)
  const adjacency = edges.map((e) => [e.source, e.target])

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — codecarto</title>
<style>
  html, body { margin: 0; height: 100%; background: ${c.page}; overflow: hidden; }
  header { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: baseline; padding: 14px 20px; pointer-events: none; }
  header .t { font: 700 12px 'Space Mono', monospace; letter-spacing: 0.14em; text-transform: uppercase; color: ${c.textPrimary}; }
  header .h { font: 10px 'Space Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: ${c.textDisabled}; }
  #stage { width: 100%; height: 100%; cursor: grab; }
  #stage:active { cursor: grabbing; }
  #stage svg { width: 100%; height: 100%; }
  .node { cursor: pointer; }
  .node, .edge { transition: opacity 200ms cubic-bezier(0.25, 0.1, 0.25, 1); }
  .dim { opacity: 0.06; }
</style>
</head>
<body>
<header><span class="t">${esc(title)}</span><span class="h">codecarto — drag to pan / scroll to zoom / click a node</span></header>
<div id="stage">${svg}</div>
<script>
(function () {
  var EDGES = ${JSON.stringify(adjacency)};
  var svg = document.querySelector('#stage svg');
  var vb = svg.viewBox.baseVal;
  var view = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  svg.removeAttribute('width'); svg.removeAttribute('height');
  function apply() { svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h); }

  var drag = null;
  svg.addEventListener('mousedown', function (e) { drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('mousemove', function (e) {
    if (!drag) return;
    var k = view.w / svg.clientWidth;
    view.x -= (e.clientX - drag.x) * k;
    view.y -= (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY };
    apply();
  });
  window.addEventListener('mouseup', function () { drag = null; });
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var k = e.deltaY > 0 ? 1.1 : 0.9;
    var r = svg.getBoundingClientRect();
    var px = view.x + ((e.clientX - r.left) / r.width) * view.w;
    var py = view.y + ((e.clientY - r.top) / r.height) * view.h;
    view.x = px - (px - view.x) * k;
    view.y = py - (py - view.y) * k;
    view.w *= k; view.h *= k;
    apply();
  }, { passive: false });

  // 點擊節點 → BFS 上下游鏈路高亮(與 app 內行為一致)
  function chainOf(start) {
    var out = {}, inn = {};
    EDGES.forEach(function (e) {
      (out[e[0]] = out[e[0]] || []).push(e[1]);
      (inn[e[1]] = inn[e[1]] || []).push(e[0]);
    });
    var seen = { }; seen[start] = true;
    [out, inn].forEach(function (adj) {
      var q = [start], local = {}; local[start] = true;
      while (q.length) {
        var cur = q.shift();
        (adj[cur] || []).forEach(function (nx) {
          if (!local[nx]) { local[nx] = true; seen[nx] = true; q.push(nx); }
        });
      }
    });
    return seen;
  }
  function reset() {
    document.querySelectorAll('.dim').forEach(function (el) { el.classList.remove('dim'); });
  }
  svg.addEventListener('click', function (e) {
    var g = e.target.closest('.node');
    if (!g) { reset(); return; }
    var chain = chainOf(g.getAttribute('data-id'));
    reset();
    document.querySelectorAll('.node').forEach(function (el) {
      if (!chain[el.getAttribute('data-id')]) el.classList.add('dim');
    });
    document.querySelectorAll('.edge').forEach(function (el) {
      if (!chain[el.getAttribute('data-source')] || !chain[el.getAttribute('data-target')]) el.classList.add('dim');
    });
  });
})();
</script>
</body>
</html>
`
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
