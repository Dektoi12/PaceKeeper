import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateProfile,
  updateSettings,
  updateWeeklyMileage,
  regenerateActivePlan,
  resetAllData,
  exportAll,
  importAll,
  backupFilename,
} from '@/services/db'
import {
  requestNotificationPermission,
  notificationsSupported,
} from '@/services/notifications'
import type { Units } from '@/services/db/types'
import { kmToUnit, unitToKm, unitLabel } from '@/lib/formatters'
import { useProfile, useLatestAssessment, useSettings } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { formatLongDate } from '@/lib/dates'
import { ScreenHeader, Card, SectionTitle } from '@/components/ui'

const round1 = (n: number) => Math.round(n * 10) / 10

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SettingsScreen() {
  const navigate = useNavigate()
  const profile = useProfile()
  const assessment = useLatestAssessment()
  const settings = useSettings()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

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

  async function saveWeeklyMileage(weeklyKm: number, longestRecentKm?: number) {
    const ok = await updateWeeklyMileage({ weeklyKm, longestRecentKm })
    toast.show(
      ok ? 'Weekly mileage saved — regenerate to apply' : 'Complete onboarding first',
      ok ? 'success' : 'default',
    )
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

  async function exportBackup() {
    setBusy(true)
    try {
      const blob = await exportAll()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backupFilename()
      a.click()
      URL.revokeObjectURL(url)
      toast.show('Backup downloaded', 'success')
    } finally {
      setBusy(false)
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      await importAll(await file.text())
      toast.show('Data restored', 'success')
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  async function toggleNotifications() {
    if (settings?.notificationsEnabled) {
      await updateSettings({ notificationsEnabled: false })
      toast.show('Reminders off')
      return
    }
    const perm = await requestNotificationPermission()
    if (perm !== 'granted') {
      toast.show('Notifications are blocked in your browser settings')
      return
    }
    await updateSettings({ notificationsEnabled: true })
    toast.show('Reminders on', 'success')
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
        <SectionTitle
          action={
            <button onClick={() => navigate('/profile/edit')} className="text-accent-400 text-sm font-medium">
              Edit
            </button>
          }
        >
          Profile
        </SectionTitle>
        <Card className="flex flex-col gap-3">
          <Row label="Name" value={profile.name} />
          <Row label="Age" value={String(profile.age)} />
          <Row label="Experience" value={profile.experience} />
          {profile.weightKg != null && <Row label="Weight" value={`${profile.weightKg} kg`} />}
          <Row label="Max HR" value={profile.maxHR != null ? `${profile.maxHR} bpm` : 'Estimated'} />
          <Row label="Resting HR" value={profile.restingHR != null ? `${profile.restingHR} bpm` : 'Not set'} />
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

        <SectionTitle>Training baseline</SectionTitle>
        <TrainingBaselineCard
          weeklyKm={assessment?.weeklyKm}
          longestRecentKm={assessment?.longestRecentKm}
          units={profile.units}
          onSave={saveWeeklyMileage}
        />

        {hr && (
          <>
            <SectionTitle
              action={
                <button onClick={() => navigate('/profile/edit')} className="text-accent-400 text-sm font-medium">
                  Edit
                </button>
              }
            >
              HR zones (reference)
            </SectionTitle>
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

        <SectionTitle>Tools</SectionTitle>
        <Card onClick={() => navigate('/tools/pace')} className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200 font-medium">Pace calculator</p>
            <p className="text-xs text-slate-500 mt-0.5">Work out pace, time, or distance from the other two.</p>
          </div>
          <span className="text-slate-500 text-lg">›</span>
        </Card>

        <SectionTitle>Data & backup</SectionTitle>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Your data lives on-device (IndexedDB). Export a JSON backup to keep it safe or move to another device.
          </p>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => importBackup(e.target.files?.[0] ?? undefined)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={exportBackup} disabled={busy}>
              Export backup
            </button>
            <button className="btn-ghost" onClick={() => importRef.current?.click()} disabled={busy}>
              Import backup
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {settings?.lastBackupAt
              ? `Last backup: ${formatLongDate(new Date(settings.lastBackupAt).toISOString().slice(0, 10))}`
              : 'No backup yet — a monthly reminder will nudge you.'}
          </p>
        </Card>

        <SectionTitle>Appearance</SectionTitle>
        <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateSettings({ theme: t })}
              className={`py-2 rounded-lg text-sm font-medium capitalize ${
                (settings?.theme ?? 'dark') === t ? 'bg-accent-500 text-white' : 'text-slate-400'
              }`}
            >
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          ))}
        </div>

        <SectionTitle>Reminders</SectionTitle>
        <Card className="flex items-center justify-between">
          <div className="pr-3">
            <p className="text-sm text-slate-200 font-medium">Run reminders</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {notificationsSupported()
                ? 'Get a nudge for the day’s run while the app is open. Background reminders depend on your device.'
                : 'Your browser doesn’t support notifications — reminders show in-app instead.'}
            </p>
          </div>
          <Toggle on={!!settings?.notificationsEnabled} onClick={toggleNotifications} disabled={!notificationsSupported()} />
        </Card>

        <SectionTitle>Coach engine</SectionTitle>
        <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl">
          {(['rule', 'ai'] as const).map((e) => (
            <button
              key={e}
              onClick={() =>
                e === 'ai' ? toast.show('AI coach arrives in a later build') : updateSettings({ coachEngine: e })
              }
              className={`py-2 rounded-lg text-sm font-medium ${
                (settings?.coachEngine ?? 'rule') === e ? 'bg-accent-500 text-white' : 'text-slate-400'
              }`}
            >
              {e === 'rule' ? 'Rule-based' : 'AI (soon)'}
            </button>
          ))}
        </div>

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

function TrainingBaselineCard({
  weeklyKm,
  longestRecentKm,
  units,
  onSave,
}: {
  weeklyKm?: number
  longestRecentKm?: number
  units: Units
  onSave: (weeklyKm: number, longestRecentKm?: number) => Promise<void>
}) {
  const [weekly, setWeekly] = useState('')
  const [longest, setLongest] = useState('')
  const [saving, setSaving] = useState(false)

  // Seed from the stored baseline, re-seeding when it changes (e.g. after save).
  useEffect(() => {
    setWeekly(weeklyKm != null ? String(round1(kmToUnit(weeklyKm, units))) : '')
    setLongest(longestRecentKm != null ? String(round1(kmToUnit(longestRecentKm, units))) : '')
  }, [weeklyKm, longestRecentKm, units])

  const weeklyNum = Number(weekly)
  const canSave = weekly.trim() !== '' && weeklyNum > 0 && !saving
  const u = unitLabel(units)

  async function save() {
    setSaving(true)
    try {
      await onSave(unitToKm(weeklyNum, units), longest ? unitToKm(Number(longest), units) : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        Your peak weekly volume. The plan starts lower — scaled to your experience level — and builds
        up to this on peak weeks. Update it, then regenerate your plan above to apply. Training paces
        stay the same.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-400">Peak weekly ({u})</span>
          <input className="input" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="30" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-slate-400">Longest recent ({u})</span>
          <input className="input" inputMode="decimal" value={longest} onChange={(e) => setLongest(e.target.value)} placeholder="12" />
        </label>
      </div>
      <button className="btn-ghost" disabled={!canSave} onClick={save}>
        {saving ? 'Saving…' : 'Save weekly mileage'}
      </button>
    </Card>
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

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-40 ${
        on ? 'bg-accent-500' : 'bg-ink-600'
      }`}
    >
      <span
        className={`block w-5 h-5 bg-white rounded-full transition-transform mx-1 ${on ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}
