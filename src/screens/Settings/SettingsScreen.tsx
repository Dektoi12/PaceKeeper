import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateProfile,
  regenerateActivePlan,
  resetAllData,
} from '@/services/db'
import type { Units } from '@/services/db/types'
import { useProfile, useLatestAssessment } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { ScreenHeader, Card, SectionTitle } from '@/components/ui'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SettingsScreen() {
  const navigate = useNavigate()
  const profile = useProfile()
  const assessment = useLatestAssessment()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  if (!profile) return <div className="p-6 text-slate-500">Loading…</div>
  const hr = assessment?.derivedHRZones

  async function setUnits(units: Units) {
    await updateProfile({ units })
    toast.show(`Units set to ${units}`)
  }

  async function toggleDay(d: number) {
    const days = profile!.preferredRunDays.includes(d)
      ? profile!.preferredRunDays.filter((x) => x !== d)
      : [...profile!.preferredRunDays, d].sort((a, b) => a - b)
    if (days.length < 2) {
      toast.show('Keep at least 2 run days')
      return
    }
    await updateProfile({ preferredRunDays: days })
  }

  async function regenerate() {
    setBusy(true)
    try {
      const res = await regenerateActivePlan()
      toast.show(res ? 'Plan regenerated' : 'Nothing to regenerate', res ? 'success' : 'default')
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    await resetAllData()
    navigate('/onboarding', { replace: true })
  }

  return (
    <div>
      <ScreenHeader
        title="Settings"
        right={
          <button onClick={() => navigate(-1)} className="text-slate-400 text-sm">
            Done
          </button>
        }
      />

      <div className="px-4">
        <SectionTitle>Profile</SectionTitle>
        <Card className="flex flex-col gap-3">
          <Row label="Name" value={profile.name} />
          <Row label="Age" value={String(profile.age)} />
          <Row label="Experience" value={profile.experience} />
        </Card>

        <SectionTitle>Units</SectionTitle>
        <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl">
          {(['km', 'mi'] as Units[]).map((u) => (
            <button
              key={u}
              onClick={() => setUnits(u)}
              className={`py-2 rounded-lg text-sm font-medium ${
                profile.units === u ? 'bg-accent-500 text-white' : 'text-slate-400'
              }`}
            >
              {u === 'km' ? 'Kilometers' : 'Miles'}
            </button>
          ))}
        </div>

        <SectionTitle>Run days</SectionTitle>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((label, d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={`py-3 rounded-xl text-xs font-medium border ${
                profile.preferredRunDays.includes(d)
                  ? 'bg-accent-500 border-accent-500 text-white'
                  : 'bg-ink-700 border-ink-600 text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn-ghost w-full mt-3" onClick={regenerate} disabled={busy}>
          {busy ? 'Regenerating…' : 'Regenerate plan from current settings'}
        </button>

        {hr && (
          <>
            <SectionTitle>HR zones (reference)</SectionTitle>
            <Card className="flex flex-col gap-1.5">
              <p className="text-xs text-slate-500 mb-1">
                Max HR {hr.maxHR} · {hr.method === 'karvonen' ? 'Karvonen (with resting HR)' : 'estimated'}
              </p>
              {hr.zones.map((z) => (
                <div key={z.zone} className="flex justify-between text-sm">
                  <span className="text-slate-400">{z.zone}</span>
                  <span className="stat-number text-slate-100">
                    {z.minBpm}–{z.maxBpm} bpm
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}

        <SectionTitle>Data & reminders</SectionTitle>
        <Card>
          <p className="text-sm text-slate-400">
            JSON backup/restore and reminders arrive in a later build. Your data is stored on-device (IndexedDB) with persistent storage requested.
          </p>
        </Card>

        <SectionTitle>Danger zone</SectionTitle>
        {!confirmReset ? (
          <button className="btn-ghost w-full text-session-intervals" onClick={() => setConfirmReset(true)}>
            Reset all data
          </button>
        ) : (
          <Card>
            <p className="text-sm text-slate-200 mb-3">
              This deletes your profile, plan, and all runs. This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button className="btn-primary bg-session-intervals" onClick={reset}>
                Delete everything
              </button>
            </div>
          </Card>
        )}

        <p className="text-center text-xs text-slate-600 mt-6 pb-4">PaceKeeper · v0.1 · local-first</p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 font-medium capitalize">{value}</span>
    </div>
  )
}
