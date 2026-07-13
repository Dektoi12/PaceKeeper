import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db, logRun } from '@/services/db'
import type { Feel, Session } from '@/services/db/types'
import { todayISO } from '@/lib/dates'
import {
  parseDurationInput,
  formatPace,
  unitToKm,
  kmToUnit,
  unitLabel,
} from '@/lib/formatters'
import { useUnits } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { ScreenHeader, Card } from '@/components/ui'
import { FeelPicker } from '@/components/FeelPicker'
import { SESSION_META } from '@/services/planEngine'

export function LogScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const units = useUnits()
  const toast = useToast()
  const prefillSessionId = (location.state as { sessionId?: string } | null)?.sessionId

  const [date, setDate] = useState(todayISO())
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [feel, setFeel] = useState<Feel | undefined>()
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')
  const [linkedSession, setLinkedSession] = useState<Session | undefined>()
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'manual' | 'import'>('manual')

  // Prefill from a planned session (spec §4.2).
  useEffect(() => {
    if (!prefillSessionId) return
    db.sessions.get(prefillSessionId).then((s) => {
      if (!s) return
      setLinkedSession(s)
      setDate(s.date)
      if (s.plannedDistanceKm) setDistance(String(round1(kmToUnit(s.plannedDistanceKm, units))))
    })
  }, [prefillSessionId, units])

  const distKm = distance ? unitToKm(Number(distance), units) : 0
  const durSec = parseDurationInput(duration)
  const paceLabel =
    distKm > 0 && durSec ? formatPace(durSec / distKm, units) : '—'

  const canSave = distKm > 0 && durSec != null && durSec > 0

  async function save() {
    if (!canSave || durSec == null) return
    setSaving(true)
    try {
      const result = await logRun({
        date,
        distanceKm: distKm,
        durationSec: durSec,
        feel,
        effortRPE: rpe ? Number(rpe) : undefined,
        notes: notes.trim() || undefined,
        attachSessionId: linkedSession?.id,
      })
      if (result.matchedSession) {
        toast.show(`Matched to ${SESSION_META[result.matchedSession.type].label} — nice one`, 'success')
      } else {
        toast.show('Run logged')
      }
      navigate(`/run/${result.run.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Log a run"
        right={
          <button onClick={() => navigate(-1)} className="text-slate-400 text-sm">
            Cancel
          </button>
        }
      />

      <div className="px-4">
        <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl mb-4">
          {(['manual', 'import'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2 rounded-lg text-sm font-medium capitalize ${
                mode === m ? 'bg-accent-500 text-white' : 'text-slate-400'
              }`}
            >
              {m === 'manual' ? 'Enter manually' : 'Import file'}
            </button>
          ))}
        </div>

        {mode === 'import' ? (
          <Card>
            <p className="text-slate-200 font-medium">GPX / TCX / FIT import</p>
            <p className="text-sm text-slate-400 mt-1">
              Watch-file import (with route map and elevation) arrives in the next build. For now, enter your run manually — totals and splits are fully supported.
            </p>
            <button className="btn-ghost w-full mt-3" onClick={() => setMode('manual')}>
              Enter manually instead
            </button>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {linkedSession && (
              <Card className="border-l-4 border-accent-500">
                <p className="text-xs text-slate-400">Logging against your planned session</p>
                <p className="font-medium text-slate-100">{linkedSession.title}</p>
              </Card>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-slate-400">Date</span>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-slate-400">Distance ({unitLabel(units)})</span>
                <input className="input" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="6.4" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-slate-400">Duration</span>
                <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="35:20" />
              </label>
            </div>

            <Card className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Pace</span>
              <span className="stat-number text-lg text-accent-400">{paceLabel}</span>
            </Card>

            <div>
              <span className="text-sm text-slate-400">How did it feel?</span>
              <div className="mt-2">
                <FeelPicker value={feel} onChange={setFeel} />
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-slate-400">Effort (RPE 1–10, optional)</span>
              <input className="input" inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="6" />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-slate-400">Notes (optional)</span>
              <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Legs felt heavy but settled after 2 km…" />
            </label>

            <button className="btn-primary" disabled={!canSave || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save run'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10
