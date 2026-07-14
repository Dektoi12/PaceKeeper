import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Experience, Units, GoalType, Assessment } from '@/services/db/types'
import { completeOnboarding, type OnboardingData } from '@/services/db'
import { TEMPLATES } from '@/services/planEngine'
import { DurationPicker } from '@/components/DurationPicker'

interface WizardState {
  name: string
  age: string
  weightKg: string
  units: Units
  experience: Experience
  goalType: GoalType
  templateId?: string
  targetDate: string
  targetTimeSec: number
  assessmentMethod: Assessment['method']
  distanceKm: string
  timeSec: number
  weeklyKm: string
  longestRecentKm: string
  maxHR: string
  restingHR: string
  runDays: number[]
}

const initial: WizardState = {
  name: '',
  age: '',
  weightKg: '',
  units: 'km',
  experience: 'intermediate',
  goalType: '10k',
  targetDate: '',
  targetTimeSec: 0,
  assessmentMethod: 'recentRace',
  distanceKm: '5',
  timeSec: 0,
  weeklyKm: '',
  longestRecentKm: '',
  maxHR: '',
  restingHR: '',
  runDays: [2, 4, 6],
}

const TOTAL_STEPS = 7
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const GOALS: { value: GoalType; label: string; hint: string }[] = [
  { value: '5k', label: '5K', hint: 'Fast and punchy' },
  { value: '10k', label: '10K', hint: 'Speed + endurance' },
  { value: 'half', label: 'Half marathon', hint: '21.1 km' },
  { value: 'full', label: 'Marathon', hint: '42.2 km' },
  { value: 'ultra', label: 'Ultra', hint: 'Beyond the marathon' },
  { value: 'fitness', label: 'Just stay fit', hint: 'No race, rolling plan' },
]

const EXPERIENCE: { value: Experience; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'New to running or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Run regularly, comfortable with 5–10K' },
  { value: 'advanced', label: 'Advanced', hint: 'Consistent mileage, some race experience' },
]

export function OnboardingScreen() {
  const [step, setStep] = useState(0)
  const [s, setS] = useState<WizardState>(initial)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setS((prev) => ({ ...prev, [key]: value }))

  const isFitness = s.goalType === 'fitness'
  const effectiveSteps = TOTAL_STEPS // keep dots stable; step 4 shows a simplified body for fitness

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return s.name.trim().length > 0 && Number(s.age) > 0
      case 1:
        return true
      case 2:
        return true
      case 3:
        return true // target date/time optional
      case 4:
        if (s.templateId) return true
        if (s.assessmentMethod === 'recentRace')
          return Number(s.distanceKm) > 0 && s.timeSec > 0
        if (s.assessmentMethod === 'weeklyMileage') return Number(s.weeklyKm) > 0
        return true // benchmarkRun needs nothing now
      case 5:
        return s.runDays.length >= 2
      default:
        return true
    }
  }

  async function submit() {
    setSubmitting(true)
    try {
      const data: OnboardingData = {
        name: s.name.trim(),
        age: Number(s.age),
        weightKg: s.weightKg ? Number(s.weightKg) : undefined,
        units: s.units,
        experience: s.experience,
        maxHR: s.maxHR ? Number(s.maxHR) : undefined,
        restingHR: s.restingHR ? Number(s.restingHR) : undefined,
        preferredRunDays: [...s.runDays].sort((a, b) => a - b),
        goalType: s.goalType,
        targetDate: !isFitness && s.targetDate ? s.targetDate : undefined,
        targetTimeSec: !isFitness && s.targetTimeSec ? s.targetTimeSec : undefined,
        assessmentMethod: s.assessmentMethod,
        distanceKm: s.assessmentMethod === 'recentRace' ? Number(s.distanceKm) : undefined,
        timeSec: s.assessmentMethod === 'recentRace' ? s.timeSec || undefined : undefined,
        weeklyKm: s.assessmentMethod === 'weeklyMileage' ? Number(s.weeklyKm) : undefined,
        longestRecentKm:
          s.assessmentMethod === 'weeklyMileage' && s.longestRecentKm
            ? Number(s.longestRecentKm)
            : undefined,
        templateId: s.templateId,
      }
      await completeOnboarding(data)
      navigate('/', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleDay = (d: number) =>
    set('runDays', s.runDays.includes(d) ? s.runDays.filter((x) => x !== d) : [...s.runDays, d])

  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-8 pb-6 safe-top">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-6">
        {Array.from({ length: effectiveSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full flex-1 transition-colors ${
              i <= step ? 'bg-accent-500' : 'bg-ink-600'
            }`}
          />
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && (
          <Step title="Welcome to PaceKeeper" subtitle="Let's set up your running.">
            <Field label="Your name">
              <input className="input" value={s.name} onChange={(e) => set('name', e.target.value)} placeholder="Dexter" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <input className="input" inputMode="numeric" value={s.age} onChange={(e) => set('age', e.target.value)} placeholder="30" />
              </Field>
              <Field label="Weight (kg, optional)">
                <input className="input" inputMode="numeric" value={s.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="70" />
              </Field>
            </div>
            <Field label="Units">
              <Segmented
                options={[
                  { value: 'km', label: 'Kilometers' },
                  { value: 'mi', label: 'Miles' },
                ]}
                value={s.units}
                onChange={(v) => set('units', v as Units)}
              />
            </Field>
          </Step>
        )}

        {step === 1 && (
          <Step title="Your experience" subtitle="Be honest — it shapes your paces and volume.">
            <div className="flex flex-col gap-3">
              {EXPERIENCE.map((e) => (
                <SelectCard
                  key={e.value}
                  active={s.experience === e.value}
                  title={e.label}
                  hint={e.hint}
                  onClick={() => set('experience', e.value)}
                />
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="What's your goal?" subtitle="Pick the race or focus you're training for.">
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <SelectCard
                  key={g.value}
                  active={s.goalType === g.value && !s.templateId}
                  title={g.label}
                  hint={g.hint}
                  onClick={() => {
                    set('goalType', g.value)
                    set('templateId', undefined)
                  }}
                />
              ))}
            </div>
            <div className="mt-5">
              <p className="text-sm text-slate-400 mb-2">Prefer a ready-made template?</p>
              <div className="flex flex-col gap-2">
                {TEMPLATES.map((t) => (
                  <SelectCard
                    key={t.id}
                    active={s.templateId === t.id}
                    title={t.name}
                    hint={t.description}
                    onClick={() => {
                      set('templateId', t.id)
                      set('goalType', t.goalType)
                    }}
                  />
                ))}
              </div>
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step
            title={isFitness ? 'Staying fit' : 'Target race'}
            subtitle={isFitness ? 'No race date needed — your plan rolls in 4-week blocks.' : 'Optional, but it tailors the plan length.'}
          >
            {isFitness ? (
              <p className="text-slate-400">Tap Next to continue.</p>
            ) : (
              <>
                <Field label="Race date (optional)">
                  <input type="date" className="input" value={s.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
                </Field>
                <Field label="Target time (optional)">
                  <DurationPicker seconds={s.targetTimeSec} onChange={(v) => set('targetTimeSec', v)} />
                </Field>
                {s.templateId && (
                  <p className="text-xs text-slate-500 mt-2">
                    Using the “{TEMPLATES.find((t) => t.id === s.templateId)?.name}” template — its fixed length overrides the race date.
                  </p>
                )}
              </>
            )}
          </Step>
        )}

        {step === 4 && (
          <Step title="Fitness check" subtitle="One input lets us calculate your training paces.">
            <Field label="Method">
              <Segmented
                options={[
                  { value: 'recentRace', label: 'Recent run' },
                  { value: 'weeklyMileage', label: 'Weekly km' },
                  { value: 'benchmarkRun', label: 'Benchmark' },
                ]}
                value={s.assessmentMethod}
                onChange={(v) => set('assessmentMethod', v as Assessment['method'])}
              />
            </Field>

            {s.assessmentMethod === 'recentRace' && (
              <div className="flex flex-col gap-3">
                <Field label={`Distance (${s.units})`}>
                  <input className="input" inputMode="decimal" value={s.distanceKm} onChange={(e) => set('distanceKm', e.target.value)} />
                </Field>
                <Field label="Time">
                  <DurationPicker seconds={s.timeSec} onChange={(v) => set('timeSec', v)} />
                </Field>
              </div>
            )}

            {s.assessmentMethod === 'weeklyMileage' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Weekly ${s.units}`}>
                  <input className="input" inputMode="decimal" value={s.weeklyKm} onChange={(e) => set('weeklyKm', e.target.value)} placeholder="30" />
                </Field>
                <Field label={`Longest recent (${s.units})`}>
                  <input className="input" inputMode="decimal" value={s.longestRecentKm} onChange={(e) => set('longestRecentKm', e.target.value)} placeholder="12" />
                </Field>
              </div>
            )}

            {s.assessmentMethod === 'benchmarkRun' && (
              <p className="text-slate-400 text-sm">
                We'll schedule a 20-minute best-effort test as an early session and refine your paces from a mid-range estimate for now.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Max HR (optional)">
                <input className="input" inputMode="numeric" value={s.maxHR} onChange={(e) => set('maxHR', e.target.value)} placeholder="auto" />
              </Field>
              <Field label="Resting HR (optional)">
                <input className="input" inputMode="numeric" value={s.restingHR} onChange={(e) => set('restingHR', e.target.value)} placeholder="—" />
              </Field>
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step title="When do you run?" subtitle={`Pick your days — ${s.runDays.length} selected (2–6).`}>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`py-3 rounded-xl text-xs font-medium border transition-colors ${
                    s.runDays.includes(d)
                      ? 'bg-accent-500 border-accent-500 text-white'
                      : 'bg-ink-700 border-ink-600 text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              The last selected day of each week becomes your long run.
            </p>
          </Step>
        )}

        {step === 6 && (
          <Step title="Ready to go" subtitle="Review, then generate your plan.">
            <div className="card p-4 flex flex-col gap-2 text-sm">
              <Row k="Name" v={s.name} />
              <Row k="Experience" v={s.experience} />
              <Row k="Goal" v={s.templateId ? TEMPLATES.find((t) => t.id === s.templateId)!.name : GOALS.find((g) => g.value === s.goalType)!.label} />
              {!isFitness && s.targetDate && <Row k="Race date" v={s.targetDate} />}
              <Row k="Run days" v={[...s.runDays].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(', ')} />
              <Row k="Fitness input" v={s.assessmentMethod} />
            </div>
          </Step>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex gap-3 pt-6">
        {step > 0 && (
          <button className="btn-ghost flex-1" onClick={() => setStep((p) => p - 1)} disabled={submitting}>
            Back
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button className="btn-primary flex-1" disabled={!canProceed()} onClick={() => setStep((p) => p + 1)}>
            Next
          </button>
        ) : (
          <button className="btn-primary flex-1" disabled={submitting} onClick={submit}>
            {submitting ? 'Generating…' : 'Generate my plan'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---- small building blocks ----

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold tracking-tight mb-1">{title}</h1>
      {subtitle && <p className="text-slate-400 mb-5">{subtitle}</p>}
      <div className="flex flex-col gap-4">{children}</div>
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

function SelectCard({ active, title, hint, onClick }: { active: boolean; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-card border transition-colors ${
        active ? 'border-accent-500 bg-accent-500/10' : 'border-ink-600 bg-ink-800 active:bg-ink-700'
      }`}
    >
      <div className="font-semibold text-slate-100">{title}</div>
      <div className="text-xs text-slate-400 mt-0.5">{hint}</div>
    </button>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 bg-ink-700 p-1 rounded-xl">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
            value === o.value ? 'bg-accent-500 text-white' : 'text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{k}</span>
      <span className="text-slate-100 font-medium capitalize">{v}</span>
    </div>
  )
}
