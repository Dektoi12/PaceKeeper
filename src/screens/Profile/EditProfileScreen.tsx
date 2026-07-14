import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Experience } from '@/services/db/types'
import { updateProfileAndZones } from '@/services/db'
import { computeHRZones, estimateMaxHR } from '@/services/zones'
import { useProfile } from '@/app/hooks'
import { useToast } from '@/components/Toast'
import { ScreenHeader, Card, SectionTitle } from '@/components/ui'

const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

interface FormState {
  name: string
  age: string
  weightKg: string
  experience: Experience
  maxHR: string
  restingHR: string
}

export function EditProfileScreen() {
  const navigate = useNavigate()
  const profile = useProfile()
  const toast = useToast()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  // Seed the form once the profile loads (live query resolves async).
  useEffect(() => {
    if (!profile || form) return
    setForm({
      name: profile.name,
      age: String(profile.age),
      weightKg: profile.weightKg != null ? String(profile.weightKg) : '',
      experience: profile.experience,
      maxHR: profile.maxHR != null ? String(profile.maxHR) : '',
      restingHR: profile.restingHR != null ? String(profile.restingHR) : '',
    })
  }, [profile, form])

  if (!form) return <div className="p-6 text-slate-500">Loading…</div>

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const age = Number(form.age) || 0
  const maxHRNum = form.maxHR ? Number(form.maxHR) : undefined
  const restingHRNum = form.restingHR ? Number(form.restingHR) : undefined

  // Live zone preview mirrors what will be persisted on save.
  const preview = age > 0 ? computeHRZones(age, maxHRNum, restingHRNum) : undefined
  const restingInvalid =
    restingHRNum != null && preview != null && restingHRNum >= preview.maxHR

  const canSave =
    form.name.trim().length > 0 &&
    age > 0 &&
    (maxHRNum == null || maxHRNum > 0) &&
    (restingHRNum == null || restingHRNum > 0)

  async function save() {
    if (!form || !canSave) return
    setSaving(true)
    try {
      await updateProfileAndZones({
        name: form.name.trim(),
        age,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        experience: form.experience,
        maxHR: maxHRNum,
        restingHR: restingHRNum,
      })
      toast.show('Profile updated', 'success')
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Edit profile"
        right={
          <button onClick={() => navigate(-1)} className="text-slate-400 text-sm">
            Cancel
          </button>
        }
      />

      <div className="px-4 flex flex-col gap-4">
        <SectionTitle>About you</SectionTitle>
        <Field label="Name">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Dexter" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Age">
            <input className="input" inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="30" />
          </Field>
          <Field label="Weight (kg, optional)">
            <input className="input" inputMode="numeric" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="70" />
          </Field>
        </div>
        <Field label="Experience">
          <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl">
            {EXPERIENCE.map((e) => (
              <button
                key={e.value}
                onClick={() => set('experience', e.value)}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.experience === e.value ? 'bg-accent-500 text-white' : 'text-slate-400'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </Field>

        <SectionTitle>Heart rate</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max HR (optional)">
            <input
              className="input"
              inputMode="numeric"
              value={form.maxHR}
              onChange={(e) => set('maxHR', e.target.value)}
              placeholder={age > 0 ? `~${estimateMaxHR(age)}` : 'auto'}
            />
          </Field>
          <Field label="Resting HR (optional)">
            <input className="input" inputMode="numeric" value={form.restingHR} onChange={(e) => set('restingHR', e.target.value)} placeholder="—" />
          </Field>
        </div>
        <p className="text-xs text-slate-500 -mt-1">
          Leave Max HR blank to estimate it from your age. Adding your resting HR switches the zones to
          the more accurate Karvonen (heart-rate reserve) method.
        </p>
        {restingInvalid && (
          <p className="text-xs text-session-intervals -mt-1">
            Resting HR should be below your max HR ({preview?.maxHR}).
          </p>
        )}

        {preview && !restingInvalid && (
          <Card className="flex flex-col gap-1.5">
            <p className="text-xs text-slate-500 mb-1">
              Zones preview · Max HR {preview.maxHR} ·{' '}
              {preview.method === 'karvonen' ? 'Karvonen (with resting HR)' : 'estimated from max HR'}
            </p>
            {preview.zones.map((z) => (
              <div key={z.zone} className="flex justify-between text-sm">
                <span className="text-slate-400">{z.zone}</span>
                <span className="stat-number text-slate-100">
                  {z.minBpm}–{z.maxBpm} bpm
                </span>
              </div>
            ))}
          </Card>
        )}

        <button className="btn-primary mt-1" disabled={!canSave || restingInvalid || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      {children}
    </label>
  )
}
