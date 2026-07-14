import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, generateWeeklyRecap } from '@/services/db'
import { SESSION_META } from '@/services/planEngine'
import { todayISO, weekDates, formatLongDate, formatDayLabel, isToday } from '@/lib/dates'
import { formatDistance } from '@/lib/formatters'
import { useProfile, useUnits, useSettings } from '@/app/hooks'
import { showReminder, sessionReminderText } from '@/services/notifications'
import { ScreenHeader, Card, StatNumber, SectionTitle, EmptyState } from '@/components/ui'
import { SessionTypeBadge } from '@/components/SessionTypeBadge'
import { ZoneChip } from '@/components/ZoneChip'
import { StepTimeline } from '@/components/StepTimeline'

export function TodayScreen() {
  const navigate = useNavigate()
  const profile = useProfile()
  const units = useUnits()
  const settings = useSettings()
  const today = todayISO()
  const week = weekDates(new Date())

  const todaySessions = useLiveQuery(() => db.sessions.where('date').equals(today).toArray(), [today])
  const weekSessions = useLiveQuery(
    () => db.sessions.where('date').anyOf(week).toArray(),
    [week.join(',')],
  )
  const weekRuns = useLiveQuery(() => db.runs.where('date').anyOf(week).toArray(), [week.join(',')])
  const upcoming = useLiveQuery(async () => {
    const all = await db.sessions.where('date').above(today).sortBy('date')
    return all.filter((s) => s.type !== 'rest').slice(0, 3)
  }, [today])

  // Generate the previous week's recap on first open of a new week (idempotent).
  const latestRecap = useLiveQuery(async () => {
    const all = await db.recaps.orderBy('weekStart').toArray()
    return all[all.length - 1]
  }, [])
  const [recapDismissed, setRecapDismissed] = useState(false)
  useEffect(() => {
    generateWeeklyRecap()
  }, [])

  const primary =
    todaySessions?.find((s) => s.type !== 'rest' && s.status !== 'completed') ??
    todaySessions?.[0]

  // Best-effort "today's run" reminder — once per day, only while the app is
  // open (background delivery isn't reliable across platforms; see notifications).
  useEffect(() => {
    if (!settings?.notificationsEnabled || !primary) return
    if (primary.type === 'rest' || primary.status === 'completed') return
    const key = `pk-notified-${today}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      return
    }
    const { title, body } = sessionReminderText(primary, units, 'today')
    showReminder(title, body)
  }, [settings?.notificationsEnabled, primary?.id, today, units])

  const actualKm = (weekRuns ?? []).reduce((sum, r) => sum + r.distanceKm, 0)
  const plannedKm = (weekSessions ?? []).reduce((sum, s) => sum + (s.plannedDistanceKm ?? 0), 0)
  const doneCount = (weekSessions ?? []).filter((s) => s.status === 'completed').length
  const runnableCount = (weekSessions ?? []).filter((s) =>
    ['easy', 'tempo', 'intervals', 'hills', 'fartlek', 'long'].includes(s.type),
  ).length

  return (
    <div>
      <ScreenHeader
        title={`Hi, ${profile?.name ?? 'runner'}`}
        subtitle={formatLongDate(today)}
        right={
          <button onClick={() => navigate('/settings')} className="text-2xl" aria-label="Settings">
            ⚙️
          </button>
        }
      />

      {/* Quick stats strip */}
      <div className="px-4">
        <Card className="flex justify-between">
          <StatNumber value={formatDistance(actualKm, units, 1)} label="this week" accent />
          <StatNumber value={`${doneCount}/${runnableCount}`} label="sessions done" />
          <StatNumber value={formatDistance(plannedKm, units, 0)} label="planned" />
        </Card>
      </div>

      {/* Weekly recap */}
      {latestRecap && !recapDismissed && (
        <div className="px-4 mt-3">
          <Card className="border-l-4 border-accent-500" onClick={() => navigate('/coach')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-accent-400 font-semibold uppercase tracking-wide">Weekly recap</p>
                <p className="text-sm text-slate-300 mt-1 line-clamp-3">{latestRecap.recapText}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setRecapDismissed(true)
                }}
                className="text-slate-500 text-lg leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Today's session hero */}
      <div className="px-4">
        <SectionTitle>Today</SectionTitle>
        {primary ? (
          <TodayHero session={primary} units={units} onLog={() => navigate('/log', { state: { sessionId: primary.id } })} onView={() => navigate(`/session/${primary.id}`)} />
        ) : (
          <Card>
            <EmptyState icon="🎉" title="Nothing scheduled today" hint="Enjoy the rest — or log an extra run." />
          </Card>
        )}
      </div>

      {/* Next 3 days */}
      <div className="px-4">
        <SectionTitle>Coming up</SectionTitle>
        <div className="flex flex-col gap-2">
          {(upcoming ?? []).length === 0 && (
            <Card>
              <p className="text-slate-400 text-sm">No further sessions — your plan may be complete.</p>
            </Card>
          )}
          {(upcoming ?? []).map((s) => {
            const meta = SESSION_META[s.type]
            return (
              <Card key={s.id} onClick={() => navigate(`/session/${s.id}`)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.title}</div>
                      <div className="text-xs text-slate-500">{isToday(s.date) ? 'Today' : formatDayLabel(s.date)}</div>
                    </div>
                  </div>
                  <SessionTypeBadge type={s.type} />
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TodayHero({
  session,
  units,
  onLog,
  onView,
}: {
  session: import('@/services/db/types').Session
  units: import('@/services/db/types').Units
  onLog: () => void
  onView: () => void
}) {
  const meta = SESSION_META[session.type]
  const isRunnable = ['easy', 'tempo', 'intervals', 'hills', 'fartlek', 'long'].includes(session.type)
  return (
    <Card className="border-l-4" >
      <div style={{ borderColor: meta.color }} className="flex items-center gap-2 mb-2">
        <SessionTypeBadge type={session.type} />
        {session.status === 'completed' && <span className="text-session-easy text-xs font-semibold">✓ Completed</span>}
      </div>
      <h2 className="text-xl font-display font-bold">{session.title}</h2>
      <p className="text-sm text-slate-400 mt-1">{meta.why}</p>

      <div className="flex flex-wrap gap-2 mt-3">
        {session.targetZone && <ZoneChip zone={session.targetZone} pace={session.targetPaceRange} units={units} />}
        {session.plannedDistanceKm != null && (
          <span className="text-sm text-slate-300 self-center">{formatDistance(session.plannedDistanceKm, units)}</span>
        )}
      </div>

      {session.steps.length > 0 && (
        <div className="mt-3 border-t border-ink-600 pt-2">
          <StepTimeline steps={session.steps.slice(0, 2)} units={units} />
          {session.steps.length > 2 && (
            <button onClick={onView} className="text-accent-400 text-sm mt-1">
              View full workout →
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button className="btn-ghost flex-1" onClick={onView}>
          View workout
        </button>
        {isRunnable && session.status !== 'completed' && (
          <button className="btn-primary flex-1" onClick={onLog}>
            Log this run
          </button>
        )}
      </div>
    </Card>
  )
}
