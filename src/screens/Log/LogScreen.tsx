import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db, logRun } from '@/services/db'
import type { Feel, Run, Session } from '@/services/db/types'
import { todayISO, formatLongDate } from '@/lib/dates'
import {
  formatPace,
  formatDistance,
  formatDuration,
  unitToKm,
  kmToUnit,
  unitLabel,
} from '@/lib/formatters'
import { encode as encodePolyline } from '@/lib/polyline'
import { parseFile, findDuplicate, type RunImport } from '@/services/importers'
import { RECORD_LABELS, BADGES_BY_ID } from '@/services/stats'
import type { LogRunResult } from '@/services/db/actions'
import { useUnits } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { ScreenHeader, Card } from '@/components/ui'
import { FeelPicker } from '@/components/FeelPicker'
import { DurationPicker } from '@/components/DurationPicker'
import { SESSION_META } from '@/services/planEngine'

export function LogScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const units = useUnits()
  const toast = useToast()
  const prefillSessionId = (location.state as { sessionId?: string } | null)?.sessionId

  const [date, setDate] = useState(todayISO())
  const [distance, setDistance] = useState('')
  const [durationSec, setDurationSec] = useState(0)
  const [feel, setFeel] = useState<Feel | undefined>()
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')
  const [linkedSession, setLinkedSession] = useState<Session | undefined>()
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'manual' | 'import'>('manual')

  // Import flow state.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState<RunImport | undefined>()
  const [importError, setImportError] = useState<string | undefined>()
  const [dupe, setDupe] = useState<Run | undefined>()

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
  const durSec = durationSec
  const paceLabel =
    distKm > 0 && durSec > 0 ? formatPace(durSec / distKm, units) : '—'

  const canSave = distKm > 0 && durSec > 0

  async function save() {
    if (!canSave) return
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
      celebrate(result, 'Run logged')
      navigate(`/run/${result.run.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  // Prefer a PR/badge celebration, then a session match, then a plain confirm.
  function celebrate(result: LogRunResult, fallback: string) {
    if (result.newPRs.length) {
      toast.show(`New PR — ${RECORD_LABELS[result.newPRs[0]]}! 🎉`, 'success')
    } else if (result.newBadges.length) {
      const badge = BADGES_BY_ID[result.newBadges[0]]
      toast.show(`Badge unlocked: ${badge?.label ?? 'nice work'} ${badge?.emoji ?? '🏅'}`, 'success')
    } else if (result.matchedSession) {
      toast.show(`Matched to ${SESSION_META[result.matchedSession.type].label} — nice one`, 'success')
    } else {
      toast.show(fallback)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setImporting(true)
    setImportError(undefined)
    setParsed(undefined)
    setDupe(undefined)
    try {
      const result = await parseFile(file)
      if (result.distanceKm <= 0 || result.durationSec <= 0) {
        throw new Error("Couldn't read a distance and time from this file.")
      }
      const sameDay = await db.runs.where('date').equals(result.date).toArray()
      setDupe(findDuplicate(result, sameDay) ?? undefined)
      setParsed(result)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Could not read this file.')
    } finally {
      setImporting(false)
    }
  }

  async function saveImport() {
    if (!parsed) return
    setSaving(true)
    try {
      const result = await logRun({
        date: parsed.date,
        distanceKm: parsed.distanceKm,
        durationSec: parsed.durationSec,
        source: parsed.source,
        splits: parsed.splits.length ? parsed.splits : undefined,
        avgHR: parsed.avgHR,
        maxHR: parsed.maxHR,
        elevationGainM: parsed.elevationGainM,
        track: parsed.track.length >= 2 ? encodePolyline(parsed.track) : undefined,
        rawFileName: parsed.rawFileName,
      })
      celebrate(result, 'Run imported')
      navigate(`/run/${result.run.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  function resetImport() {
    setParsed(undefined)
    setImportError(undefined)
    setDupe(undefined)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,.tcx,.fit"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
            />

            {!parsed && (
              <Card>
                <p className="text-slate-200 font-medium">Import from your watch</p>
                <p className="text-sm text-slate-400 mt-1">
                  Drop in a GPX, TCX, or FIT export (Zepp, Garmin, Strava…). We'll read your route,
                  splits, heart rate, and elevation.
                </p>
                <button
                  className="btn-primary w-full mt-3"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importing ? 'Reading file…' : 'Choose file'}
                </button>
                {importError && (
                  <p className="text-sm text-session-intervals mt-3">{importError}</p>
                )}
              </Card>
            )}

            {parsed && (
              <>
                <Card>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-100">{parsed.rawFileName}</p>
                    <span className="text-xs text-slate-500">{parsed.source.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{formatLongDate(parsed.date)}</p>

                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <PreviewStat value={formatDistance(parsed.distanceKm, units)} label="distance" />
                    <PreviewStat value={formatDuration(parsed.durationSec)} label="time" />
                    <PreviewStat
                      value={formatPace(parsed.avgPaceSecPerKm, units).split(' ')[0]}
                      label={`pace /${units}`}
                    />
                    {parsed.avgHR != null && <PreviewStat value={String(parsed.avgHR)} label="avg HR" />}
                    {parsed.elevationGainM != null && (
                      <PreviewStat value={`${parsed.elevationGainM} m`} label="elev gain" />
                    )}
                    {parsed.splits.length > 0 && (
                      <PreviewStat value={String(parsed.splits.length)} label="splits" />
                    )}
                  </div>

                  {parsed.totalsOnly && (
                    <p className="text-xs text-slate-500 mt-3">
                      No GPS track in this file — it'll be saved with totals and any splits.
                    </p>
                  )}
                </Card>

                {dupe && (
                  <Card className="border-l-4 border-session-intervals">
                    <p className="text-sm text-slate-200 font-medium">Looks like a duplicate</p>
                    <p className="text-sm text-slate-400 mt-1">
                      You already logged a run on {formatLongDate(dupe.date)} with nearly the same
                      distance and time. Import anyway?
                    </p>
                  </Card>
                )}

                <button className="btn-primary" disabled={saving} onClick={saveImport}>
                  {saving ? 'Saving…' : dupe ? 'Import anyway' : 'Save imported run'}
                </button>
                <button className="btn-ghost" onClick={resetImport}>
                  Choose a different file
                </button>
              </>
            )}

            <button className="text-sm text-slate-500 py-1" onClick={() => setMode('manual')}>
              Enter manually instead
            </button>
          </div>
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

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-slate-400">Distance ({unitLabel(units)})</span>
              <input className="input" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="6.4" />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-slate-400">Duration</span>
              <DurationPicker seconds={durationSec} onChange={setDurationSec} />
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

function PreviewStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="stat-number text-lg text-slate-100">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}
