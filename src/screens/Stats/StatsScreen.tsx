import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/services/db'
import type { Run, SessionType } from '@/services/db/types'
import { fromISO, format } from '@/lib/dates'
import { formatDistance, formatPace } from '@/lib/formatters'
import { useUnits } from '@/app/hooks'
import { SESSION_META } from '@/services/planEngine'
import { ScreenHeader, Card, StatNumber, SectionTitle, EmptyState } from '@/components/ui'
import { feelEmoji } from '@/components/FeelPicker'

export function StatsScreen() {
  const navigate = useNavigate()
  const units = useUnits()

  const runs = useLiveQuery(async () => {
    const all = await db.runs.orderBy('date').reverse().toArray()
    return all.sort((a, b) => b.createdAt - a.createdAt).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [])

  const matchedTypes = useLiveQuery(async () => {
    const map: Record<string, SessionType> = {}
    const runList = await db.runs.toArray()
    const ids = runList.map((r) => r.matchedSessionId).filter(Boolean) as string[]
    if (ids.length) {
      const sessions = await db.sessions.where('id').anyOf(ids).toArray()
      for (const s of sessions) map[s.id] = s.type
    }
    return map
  }, [])

  const totalKm = (runs ?? []).reduce((sum, r) => sum + r.distanceKm, 0)
  const totalRuns = runs?.length ?? 0
  const longest = (runs ?? []).reduce((m, r) => Math.max(m, r.distanceKm), 0)

  const grouped = groupByMonth(runs ?? [])

  return (
    <div>
      <ScreenHeader title="Stats" />

      <div className="px-4">
        <Card className="flex justify-between">
          <StatNumber value={formatDistance(totalKm, units, 0).split(' ')[0]} label={`${units} lifetime`} accent />
          <StatNumber value={totalRuns} label="runs" />
          <StatNumber value={formatDistance(longest, units, 1).split(' ')[0]} label="longest" />
        </Card>

        <SectionTitle>Personal records</SectionTitle>
        <Card>
          <p className="text-sm text-slate-400">
            PR tracking, charts, and race predictions arrive in the next build. Your runs below already feed them.
          </p>
        </Card>

        <SectionTitle>Run history</SectionTitle>
        {totalRuns === 0 ? (
          <Card>
            <EmptyState icon="🏃" title="No runs yet" hint="Tap + to log your first run." />
          </Card>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {grouped.map(([month, monthRuns]) => (
              <div key={month}>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1.5">{month}</p>
                <div className="flex flex-col gap-2">
                  {monthRuns.map((r) => {
                    const type = r.matchedSessionId ? matchedTypes?.[r.matchedSessionId] : undefined
                    return (
                      <Card key={r.id} onClick={() => navigate(`/run/${r.id}`)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{type ? SESSION_META[type].icon : '🏃'}</span>
                            <div>
                              <div className="font-medium text-slate-100">{formatDistance(r.distanceKm, units)}</div>
                              <div className="text-xs text-slate-500">{format(fromISO(r.date), 'EEE, MMM d')}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="stat-number text-sm text-slate-200">{formatPace(r.avgPaceSecPerKm, units)}</div>
                            <div className="text-xs text-slate-500">
                              {feelEmoji(r.feel)} {r.source === 'manual' ? '✍️' : '📁'}
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function groupByMonth(runs: Run[]): [string, Run[]][] {
  const groups = new Map<string, Run[]>()
  for (const r of runs) {
    const key = format(fromISO(r.date), 'MMMM yyyy')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  return Array.from(groups.entries())
}
