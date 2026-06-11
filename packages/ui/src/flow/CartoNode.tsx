import { useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useCartoStore } from '../store'
import { NODE_WIDTH } from '../layout'
import { KIND_META, type CartoFlowNode } from './buildFlow'

/**
 * 節點 = 紙面上的儀表模組:白卡、1px 框、左墨條編碼 kind。
 * 階層全靠字級與灰階:KIND 標籤(mono caps 9px)→ 名稱(Grotesk 13px)→ 路徑(mono 10px)。
 */
export function CartoNode({ data, selected }: NodeProps<CartoFlowNode>) {
  const editing = useCartoStore((s) => s.editingId === data.nodeId)
  const [draft, setDraft] = useState(data.label)

  useEffect(() => {
    if (editing) setDraft(data.label)
  }, [editing, data.label])

  const commit = () => {
    const store = useCartoStore.getState()
    store.setEditing(null)
    if (draft !== data.label) store.renameNode(data.nodeId, draft)
  }

  return (
    <div
      className={`nd-node ${data.flash ? 'carto-flash' : ''}`}
      data-selected={selected || undefined}
      data-dashed={data.kind === 'external' || undefined}
      data-unresolved={data.unresolved || undefined}
      data-curated-hidden={data.hidden || undefined}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-stretch">
        {data.bar && (
          <div
            className={`w-[3px] shrink-0 rounded-l-[3px] ${data.bar === 'striped' ? 'nd-bar-striped' : ''}`}
            style={data.bar !== 'striped' ? { background: data.bar } : undefined}
          />
        )}
        <div className="px-2.5 py-1.5 min-w-0 flex-1">
          <div
            className="nd-mono flex items-center gap-2 uppercase"
            style={{ fontSize: 9, letterSpacing: '0.08em', color: data.unresolved ? 'var(--accent)' : 'var(--text-secondary)' }}
          >
            <span>{KIND_META[data.kind].label}</span>
            {data.runtime === 'client' && <span>Client</span>}
            {data.pinned && <span>Pin</span>}
            {data.groupLabel && (
              <span className="ml-auto truncate max-w-[70px]" style={{ color: 'var(--text-disabled)' }} title={data.groupLabel}>
                {data.groupLabel}
              </span>
            )}
          </div>
          {editing ? (
            <input
              autoFocus
              className="nodrag w-full font-medium outline-none"
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--text-display)',
                padding: 0,
              }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') useCartoStore.getState().setEditing(null)
              }}
            />
          ) : (
            <div className="truncate font-medium" style={{ fontSize: 13, color: 'var(--text-primary)' }} title={data.label}>
              {data.label}
            </div>
          )}
          {data.sub && (
            <div className="nd-mono truncate" style={{ fontSize: 10, color: 'var(--text-disabled)' }} title={data.sub}>
              {data.sub}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
