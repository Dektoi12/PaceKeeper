import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/services/db'
import { SESSION_META } from '@/services/planEngine'
import type { Session } from '@/services/db/types'
import {
  weekDates,
  addDays,
  toISO,
  fromISO,
  isToday,
  formatMonthLabel,
  weekStart,
} from '@/lib/dates'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useUnits } from '@/app/hooks'
import { ScreenHeader } from '@/components/ui'
import { SessionCard } from '@/components/SessionCard'
import { SessionDot } from '@/components/SessionTypeBadge'

type View = 'week' | 'month'

export function PlanScreen() {
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(() => toISO(new Date()))
  const units = useUnits()
  const navigate = useNavigate()

  return (
    <div>
      <ScreenHeader
        title="Plan"
        right={
          <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl text-sm">
            {(['week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize ${
                  view === v ? 'bg-accent-500 text-white' : 'text-slate-400'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        }
      />
      {view === 'week' ? (
        <WeekView cursor={cursor} setCursor={setCursor} units={units} onOpen={(id) => navigate(`/session/${id}`)} />
      ) : (
        <MonthView
          cursor={cursor}
          setCursor={setCursor}
          onPickDay={(iso) => {
            setCursor(iso)
            setView('week')
          }}
        />
      )}
    </div>
  )
}

function WeekView({
  cursor,
  setCursor,
  units,
  onOpen,
}: {
  cursor: string
  setCursor: (iso: string) => void
  units: import('@/services/db/types').Units
  onOpen: (id: string) => void
}) {
  const days = weekDates(fromISO(cursor))
  const sessions = useLiveQuery(() => db.sessions.where('date').anyOf(days).toArray(), [days.join(',')])

  const byDay = (iso: string) => (sessions ?? []).filter((s) => s.date === iso).sort(sortSession)
  const label = `Week of ${format(weekStart(fromISO(cursor)), 'MMM d')}`

  return (
    <div className="px-4">
      <WeekNav
        label={label}
        onPrev={() => setCursor(toISO(addDays(fromISO(cursor), -7)))}
        onNext={() => setCursor(toISO(addDays(fromISO(cursor), 7)))}
        onToday={() => setCursor(toISO(new Date()))}
      />
      <div className="flex flex-col gap-4 mt-2">
        {days.map((iso) => {
          const daySessions = byDay(iso)
          return (
            <div key={iso}>
              <div className={`flex items-center gap-2 mb-1.5 ${isToday(iso) ? 'text-accent-400' : 'text-slate-400'}`}>
                <span className="text-sm font-semibold">{format(fromISO(iso), 'EEEE')}</span>
                <span className="text-xs">{format(fromISO(iso), 'MMM d')}</span>
                {isToday(iso) && <span className="text-[10px] bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded">Today</span>}
              </div>
              <div className="flex flex-col gap-2">
                {daySessions.map((s) => (
                  <SessionCard key={s.id} session={s} units={units} onClick={() => onOpen(s.id)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({
  cursor,
  setCursor,
  onPickDay,
}: {
  cursor: string
  setCursor: (iso: string) => void
  onPickDay: (iso: string) => void
}) {
  const monthDate = fromISO(cursor)
  const gridStart = weekStart(startOfMonth(monthDate))
  const gridEnd = weekStart(addDays(endOfMonth(monthDate), 7))
  const cells: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(toISO(d))
  const rangeIso = cells

  const sessions = useLiveQuery(
    () => db.sessions.where('date').anyOf(rangeIso).toArray(),
    [rangeIso.join(',')],
  )
  const byDay = (iso: string) => (sessions ?? []).filter((s) => s.date === iso).sort(sortSession)

  return (
    <div className="px-4">
      <WeekNav
        label={formatMonthLabel(cursor)}
        onPrev={() => setCursor(toISO(addDays(startOfMonth(monthDate), -1)))}
        onNext={() => setCursor(toISO(addDays(endOfMonth(monthDate), 1)))}
        onToday={() => setCursor(toISO(new Date()))}
      />
      <div className="grid grid-cols-7 gap-1 mt-3 text-center text-[10px] text-slate-500 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso) => {
          const inMonth = fromISO(iso).getMonth() === monthDate.getMonth()
          const daySessions = byDay(iso).filter((s) => s.type !== 'rest')
          return (
            <button
              key={iso}
              onClick={() => onPickDay(iso)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-start pt-1 border ${
                isToday(iso) ? 'border-accent-500' : 'border-ink-700'
              } ${inMonth ? 'bg-ink-800' : 'bg-transparent opacity-40'}`}
            >
              <span className={`text-[11px] ${isToday(iso) ? 'text-accent-400 font-bold' : 'text-slate-400'}`}>
                {format(fromISO(iso), 'd')}
              </span>
              <div className="flex flex-wrap gap-0.5 justify-center mt-0.5 px-0.5">
                {daySessions.slice(0, 3).map((s) => (
                  <SessionDot key={s.id} type={s.type} filled={s.status === 'completed'} />
                ))}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {Object.entries(SESSION_META)
          .filter(([k]) => k !== 'rest')
          .map(([k, m]) => (
            <span key={k} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.label}
            </span>
          ))}
      </div>
    </div>
  )
}

function WeekNav({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <button onClick={onPrev} className="btn-ghost px-3 py-1.5">
        ‹
      </button>
      <button onClick={onToday} className="text-sm font-semibold text-slate-200">
        {label}
      </button>
      <button onClick={onNext} className="btn-ghost px-3 py-1.5">
        ›
      </button>
    </div>
  )
}

function sortSession(a: Session, b: Session): number {
  const order = (t: string) => (t === 'rest' ? 1 : 0)
  return order(a.type) - order(b.type)
}
