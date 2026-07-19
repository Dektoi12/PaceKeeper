import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/services/db'
import type { RecordKind, Run, Session, SessionType, StrengthActivityLog } from '@/services/db/types'
import { fromISO, format } from '@/lib/dates'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { useUnits, useActiveGoal } from '@/app/hooks'
import { SESSION_META } from '@/services/planEngine'
import { RECORD_LABELS, RECORD_ORDER, predictRaces, BADGES_BY_ID, computeWeeklyStreak } from '@/services/stats'
import { ScreenHeader, Card, StatNumber, SectionTitle, EmptyState } from '@/components/ui'
import { feelEmoji } from '@/components/FeelPicker'

const StatsCharts = lazy(() => import('./StatsCharts'))

export function StatsScreen() {
  const navigate = useNavigate()
  const units = useUnits()
  const goal = useActiveGoal()

  const runs = useLiveQuery(async () => {
    const all = await db.runs.orderBy('date').reverse().toArray()
    return all.sort((a, b) => b.createdAt - a.createdAt).sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [])

  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const records = useLiveQuery(() => db.records.toArray(), [])
  const achievements = useLiveQuery(() => db.achievements.toArray(), [])

  const strengthSessions = useLiveQuery(
    () => db.sessions.where('type').anyOf('strength', 'mobility').toArray(),
    [],
  )
  const strengthLogs = useLiveQuery(() => db.strengthActivityLog.orderBy('date').reverse().toArray(), [])

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

  const strengthStreak = computeWeeklyStreak(strengthSessions ?? [])
  const strengthHistory = mergeStrengthHistory(strengthSessions ?? [], strengthLogs ?? [])

  // Runs matched to an easy session drive the easy-pace trend.
  const easyRunIds = new Set(
    (runs ?? [])
      .filter((r) => r.matchedSessionId && matchedTypes?.[r.matchedSessionId] === 'easy')
      .map((r) => r.id),
  )

  const recordByKind = new Map((records ?? []).map((r) => [r.kind, r]))
  const prediction = runs && runs.length ? predictRaces(runs, goal) : null
  const unlockedBadges = (achievements ?? [])
    .map((a) => BADGES_BY_ID[a.badgeId])
    .filter(Boolean)

  const formatRecordValue = (kind: RecordKind, value: number): string => {
    if (kind.startsWith('fastest')) return formatDuration(value)
    if (kind === 'longestStreak') return `${value} day${value === 1 ? '' : 's'}`
    return formatDistance(value, units, 1)
  }

  return (
    <div>
      <ScreenHeader title="Stats" />

      <div className="px-4">
        <Card className="flex justify-between">
          <StatNumber value={formatDistance(totalKm, units, 0).split(' ')[0]} label={`${units} lifetime`} accent />
          <StatNumber value={totalRuns} label="runs" />
          <StatNumber value={formatDistance(longest, units, 1).split(' ')[0]} label="longest" />
        </Card>

        {totalRuns > 0 && (
          <>
            <SectionTitle>Personal records</SectionTitle>
            {recordByKind.size === 0 ? (
              <Card>
                <p className="text-sm text-slate-400">
                  Keep logging runs — PRs unlock automatically as you hit standard distances.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {RECORD_ORDER.filter((k) => recordByKind.has(k)).map((kind) => {
                  const rec = recordByKind.get(kind)!
                  return (
                    <Card
                      key={kind}
                      onClick={rec.runId ? () => navigate(`/run/${rec.runId}`) : undefined}
                    >
                      <p className="text-xs text-slate-500">{RECORD_LABELS[kind]}</p>
                      <p className="stat-number text-lg text-accent-400 mt-0.5">
                        {formatRecordValue(kind, rec.value)}
                      </p>
                    </Card>
                  )
                })}
              </div>
            )}

            {prediction && (
              <>
                <SectionTitle>Race predictor</SectionTitle>
                <Card>
                  <p className="text-xs text-slate-500 mb-2">
                    From your best recent effort (VDOT {prediction.vdot})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {prediction.predictions.map((p) => (
                      <div key={p.label} className="flex flex-col items-center">
                        <span className="text-xs text-slate-500">{p.label}</span>
                        <span className="stat-number text-sm text-slate-100 mt-0.5">
                          {formatDuration(p.timeSec)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {prediction.goal && (
                    <div className="mt-3 pt-3 border-t border-ink-700 text-sm">
                      {prediction.goal.gapSec <= 0 ? (
                        <span className="text-session-easy">
                          🎯 On track — predicted {formatDuration(prediction.goal.predictedTimeSec)} beats your
                          goal of {formatDuration(prediction.goal.targetTimeSec)}.
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          Goal {formatDuration(prediction.goal.targetTimeSec)} — you're about{' '}
                          {formatDuration(prediction.goal.gapSec)} off the pace. Keep building.
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              </>
            )}

            {unlockedBadges.length > 0 && (
              <>
                <SectionTitle>Badges</SectionTitle>
                <Card>
                  <div className="flex flex-wrap gap-3">
                    {unlockedBadges.map((b) => (
                      <div key={b.id} className="flex flex-col items-center w-16 text-center" title={b.description}>
                        <span className="text-2xl">{b.emoji}</span>
                        <span className="text-[10px] text-slate-400 mt-1 leading-tight">{b.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}

            <SectionTitle>Trends</SectionTitle>
            <Suspense fallback={<Card><div className="h-32 bg-ink-700 rounded animate-pulse" /></Card>}>
              <StatsCharts
                runs={runs ?? []}
                sessions={sessions ?? []}
                units={units}
                easyRunIds={easyRunIds}
              />
            </Suspense>
          </>
        )}

        {strengthHistory.length > 0 && (
          <>
            <SectionTitle
              action={
                strengthStreak.current > 0 ? (
                  <span className="text-xs text-accent-400 font-semibold">
                    🔥 {strengthStreak.current} wk streak
                  </span>
                ) : undefined
              }
            >
              Strength history
            </SectionTitle>
            <div className="flex flex-col gap-2 mb-2">
              {strengthHistory.slice(0, 10).map((item) => (
                <Card key={item.id} onClick={item.sessionId ? () => navigate(`/session/${item.sessionId}`) : undefined}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <div className="font-medium text-slate-100">{item.title}</div>
                        <div className="text-xs text-slate-500">{format(fromISO(item.date), 'EEE, MMM d')}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">{item.detail}</div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

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

interface StrengthHistoryItem {
  id: string
  date: string
  icon: string
  title: string
  detail: string
  sessionId?: string
}

/** Completed scheduled strength/mobility sessions + manual logs, newest first. */
function mergeStrengthHistory(
  sessions: Session[],
  logs: StrengthActivityLog[],
): StrengthHistoryItem[] {
  const fromSessions: StrengthHistoryItem[] = sessions
    .filter((s) => s.status === 'completed')
    .map((s) => ({
      id: s.id,
      date: s.date,
      icon: SESSION_META[s.type].icon,
      title: s.title,
      detail: s.strengthLog?.perceivedEffort != null ? `Effort ${s.strengthLog.perceivedEffort}/5` : '',
      sessionId: s.id,
    }))
  const fromLogs: StrengthHistoryItem[] = logs.map((l) => ({
    id: l.id,
    date: l.date,
    icon: '🏋️',
    title: l.label || 'Strength session',
    detail: `${l.durationMinutes} min`,
  }))
  return [...fromSessions, ...fromLogs].sort((a, b) => (a.date < b.date ? 1 : -1))
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
