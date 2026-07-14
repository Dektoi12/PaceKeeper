import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setPersonalRecord, clearPersonalRecord } from '@/services/db'
import type { PRRecord, RecordKind } from '@/services/db/types'
import {
  RECORD_ORDER,
  RECORD_LABELS,
  isTimeRecord,
} from '@/services/stats'
import {
  formatDuration,
  formatDistance,
  kmToUnit,
  unitToKm,
  unitLabel,
} from '@/lib/formatters'
import { useUnits } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { ScreenHeader, Card, SectionTitle } from '@/components/ui'
import { DurationPicker } from '@/components/DurationPicker'

const isDistanceRecord = (k: RecordKind) => k === 'longestRun' || k === 'biggestWeek'
// A slow 5K stays under an hour; longer races can run over — show hours there.
const needsHours = (k: RecordKind) => k === 'fastest10k' || k === 'fastestHalf' || k === 'fastestFull'
// Race PBs drive training paces (and a plan regen); the rest are just records.
const affectsPlan = (k: RecordKind) => isTimeRecord(k)

export function EditRecordsScreen() {
  const navigate = useNavigate()
  const units = useUnits()
  const toast = useToast()

  const records = useLiveQuery(() => db.records.toArray(), [])
  const byKind = new Map((records ?? []).map((r) => [r.kind, r]))

  const [editing, setEditing] = useState<RecordKind | null>(null)
  const [timeSec, setTimeSec] = useState(0)
  const [numText, setNumText] = useState('')
  const [saving, setSaving] = useState(false)

  function open(kind: RecordKind, current?: PRRecord) {
    setEditing(kind)
    if (isTimeRecord(kind)) {
      setTimeSec(current?.value ?? 0)
    } else if (isDistanceRecord(kind)) {
      setNumText(current ? String(round1(kmToUnit(current.value, units))) : '')
    } else {
      setNumText(current ? String(current.value) : '')
    }
  }

  function valueFor(kind: RecordKind): number {
    if (isTimeRecord(kind)) return timeSec
    if (isDistanceRecord(kind)) return unitToKm(Number(numText) || 0, units)
    return Math.round(Number(numText) || 0)
  }

  async function save(kind: RecordKind) {
    const value = valueFor(kind)
    if (value <= 0) return
    setSaving(true)
    try {
      const { planRegenerated } = await setPersonalRecord(kind, value)
      toast.show(
        planRegenerated ? `${RECORD_LABELS[kind]} saved — paces & plan updated` : `${RECORD_LABELS[kind]} saved`,
        'success',
      )
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function remove(kind: RecordKind) {
    await clearPersonalRecord(kind)
    toast.show(`${RECORD_LABELS[kind]} cleared`)
    setEditing(null)
  }

  function formatValue(rec: PRRecord): string {
    if (isTimeRecord(rec.kind)) return formatDuration(rec.value)
    if (isDistanceRecord(rec.kind)) return formatDistance(rec.value, units, 1)
    return `${rec.value} day${rec.value === 1 ? '' : 's'}`
  }

  return (
    <div>
      <ScreenHeader
        title="Edit records"
        right={
          <button onClick={() => navigate(-1)} className="text-slate-400 text-sm">
            Done
          </button>
        }
      />

      <div className="px-4">
        <p className="text-sm text-slate-400">
          Add a personal best or correct one. Editing a race PB (5K–marathon) re-derives your training
          paces and regenerates your plan.
        </p>

        <SectionTitle>Records</SectionTitle>
        <div className="flex flex-col gap-2 pb-4">
          {RECORD_ORDER.map((kind) => {
            const rec = byKind.get(kind)
            const isOpen = editing === kind
            return (
              <Card key={kind}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-100">{RECORD_LABELS[kind]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {rec ? formatValue(rec) : 'Not set'}
                      {rec?.manual && <span className="text-accent-400"> · manual</span>}
                    </p>
                  </div>
                  {!isOpen && (
                    <button onClick={() => open(kind, rec)} className="text-accent-400 text-sm font-medium">
                      {rec ? 'Edit' : 'Add'}
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 flex flex-col gap-3">
                    {isTimeRecord(kind) ? (
                      <DurationPicker seconds={timeSec} onChange={setTimeSec} showHours={needsHours(kind)} />
                    ) : (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm text-slate-400">
                          {isDistanceRecord(kind) ? `Distance (${unitLabel(units)})` : 'Days'}
                        </span>
                        <input
                          className="input"
                          inputMode={isDistanceRecord(kind) ? 'decimal' : 'numeric'}
                          value={numText}
                          onChange={(e) => setNumText(e.target.value)}
                          placeholder={isDistanceRecord(kind) ? '10' : '7'}
                        />
                      </label>
                    )}

                    {affectsPlan(kind) && (
                      <p className="text-xs text-slate-500">
                        Saving updates your training paces and regenerates the plan.
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button className="btn-primary flex-1" disabled={saving || valueFor(kind) <= 0} onClick={() => save(kind)}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      {rec?.manual && (
                        <button className="btn-ghost" disabled={saving} onClick={() => remove(kind)}>
                          Clear
                        </button>
                      )}
                      <button className="btn-ghost" disabled={saving} onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10
