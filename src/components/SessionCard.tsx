import type { Session, Units } from '@/services/db/types'
import { SESSION_META } from '@/services/planEngine'
import { formatDistance } from '@/lib/formatters'
import { SessionTypeBadge } from './SessionTypeBadge'
import { ZoneChip } from './ZoneChip'
import { Card } from './ui'

export function SessionCard({
  session,
  units,
  onClick,
  compact = false,
}: {
  session: Session
  units: Units
  onClick?: () => void
  compact?: boolean
}) {
  const meta = SESSION_META[session.type]
  const done = session.status === 'completed'
  const skipped = session.status === 'skipped'
  const inProgress = session.status === 'inProgress'
  const exerciseCount = session.steps.filter((s) => s.kind === 'exercise').length
  const isStrengthLike = session.type === 'strength' || session.type === 'mobility'

  return (
    <Card onClick={onClick} className={done ? 'opacity-70' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <SessionTypeBadge type={session.type} />
            {done && <span className="text-session-easy text-xs font-semibold">✓ Done</span>}
            {inProgress && <span className="text-accent-400 text-xs font-semibold">● In progress</span>}
            {skipped && <span className="text-slate-500 text-xs">Skipped</span>}
          </div>
          <h3
            className={`font-semibold text-slate-100 truncate ${skipped ? 'line-through text-slate-500' : ''}`}
          >
            {session.title}
          </h3>
          {!compact && isStrengthLike && exerciseCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-400">
              <span>
                {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
              </span>
              {session.plannedDurationMin != null && <span>· {session.plannedDurationMin} min</span>}
            </div>
          )}
          {!compact && !isStrengthLike && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {session.targetZone && (
                <ZoneChip zone={session.targetZone} pace={session.targetPaceRange} units={units} />
              )}
              {session.plannedDistanceKm != null && (
                <span className="text-sm text-slate-400">
                  {formatDistance(session.plannedDistanceKm, units)}
                </span>
              )}
              {session.plannedDurationMin != null && (
                <span className="text-sm text-slate-400">{session.plannedDurationMin} min</span>
              )}
            </div>
          )}
        </div>
        <div
          className="w-1.5 self-stretch rounded-full shrink-0"
          style={{ backgroundColor: meta.color }}
        />
      </div>
    </Card>
  )
}
