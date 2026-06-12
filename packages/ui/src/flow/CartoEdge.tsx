import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

/** edge id → 穩定的負相位起點,讓全圖封包錯開、不同步脈動 */
function phaseOf(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `${-((Math.abs(h) % 3000) / 1000)}s`
}

/**
 * 圖邊 = 線 + 沿線行進的封包點(packet-tracer 式方向提示)。
 * 封包跟線同色同透明度;大圖低 zoom 與匯出截圖時由 CSS 關閉
 * ([data-zoom-far] / [data-exporting])。
 */
export function CartoEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      <circle
        className="carto-packet"
        r={2.5}
        fill={(style?.stroke as string) ?? 'currentColor'}
        opacity={(style?.opacity as number) ?? 1}
      >
        <animateMotion dur="3s" repeatCount="indefinite" path={path} begin={phaseOf(id)} />
      </circle>
    </>
  )
}
