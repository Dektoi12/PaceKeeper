import type { SessionType } from '@/services/db/types'
import { SESSION_META } from '@/services/planEngine'
import { Chip } from './ui'

export function SessionTypeBadge({ type }: { type: SessionType }) {
  const meta = SESSION_META[type]
  return (
    <Chip color={meta.color}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </Chip>
  )
}

export function SessionDot({ type, filled }: { type: SessionType; filled?: boolean }) {
  const meta = SESSION_META[type]
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{
        backgroundColor: filled ? meta.color : 'transparent',
        border: `1.5px solid ${meta.color}`,
      }}
    />
  )
}
