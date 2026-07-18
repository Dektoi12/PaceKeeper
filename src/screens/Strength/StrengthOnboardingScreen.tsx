import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  EquipmentType,
  Experience,
  StrengthGoal,
  StrengthPreferences,
} from '@/services/db/types'
import { DEFAULT_STRENGTH_PREFS } from '@/services/db/types'
import { applyStrengthPreferences } from '@/services/db'
import { ProgressDots, Step, SelectCard, MultiSelectCard, Segmented } from '@/components/wizard'
import { useToast } from '@/components/Toast'

const TOTAL_STEPS = 5

const GOALS: { value: StrengthGoal; label: string; hint: string }[] = [
  { value: 'runningFocus', label: 'Running Focus', hint: 'Legs & core to support running and prevent injury.' },
  { value: 'allRoundStrength', label: 'All-Round Strength', hint: 'Balanced full-body development.' },
  { value: 'upperBodyFocus', label: 'Upper Body Focus', hint: 'Build upper body; keep legs fresh for runs.' },
]

const EXPERIENCE: { value: Experience; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'New to strength training.' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Comfortable with the basics.' },
  { value: 'advanced', label: 'Advanced', hint: 'Experienced and consistent.' },
]

const EQUIPMENT: { value: EquipmentType; label: string; hint: string }[] = [
  { value: 'none', label: 'Bodyweight only', hint: 'Always available.' },
  { value: 'resistanceBand', label: 'Resistance band', hint: 'Rows and pulls.' },
  { value: 'dumbbells', label: 'Dumbbells', hint: 'Presses and loaded lifts.' },
  { value: 'pullUpBar', label: 'Pull-up bar', hint: 'Pull-up progressions.' },
  { value: 'gym', label: 'Full gym', hint: 'Everything above.' },
]

export function StrengthOnboardingScreen() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [goal, setGoal] = useState<StrengthGoal>(DEFAULT_STRENGTH_PREFS.goal)
  const [experienceLevel, setExperienceLevel] = useState<Experience>(DEFAULT_STRENGTH_PREFS.experienceLevel)
  const [equipment, setEquipment] = useState<EquipmentType[]>([...DEFAULT_STRENGTH_PREFS.equipment])
  const [sessionLengthMinutes, setSessionLength] = useState<20 | 30 | 45>(
    DEFAULT_STRENGTH_PREFS.sessionLengthMinutes,
  )
  const [frequencyPerWeek, setFrequency] = useState<1 | 2 | 3>(DEFAULT_STRENGTH_PREFS.frequencyPerWeek)

  const toggleEquipment = (e: EquipmentType) => {
    if (e === 'none') return // bodyweight always implied
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
  }

  async function finish(prefs?: Partial<StrengthPreferences>) {
    setSubmitting(true)
    try {
      const equip = equipment.includes('none') ? equipment : ['none', ...equipment]
      await applyStrengthPreferences({
        enabled: true,
        goal,
        experienceLevel,
        equipment: equip as EquipmentType[],
        sessionLengthMinutes,
        frequencyPerWeek,
        updatedAt: Date.now(),
        ...prefs,
      })
      toast.show('Strength training added to your plan', 'success')
      navigate('/plan', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const isLast = step === TOTAL_STEPS - 1

  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col px-5 pt-8 pb-6 safe-top">
      <div className="flex items-center justify-between mb-2">
        <button className="text-slate-400 text-sm" onClick={() => navigate(-1)}>
          ‹ Back to app
        </button>
        <button
          className="text-slate-500 text-sm"
          disabled={submitting}
          onClick={() => finish()}
        >
          Skip
        </button>
      </div>

      <ProgressDots total={TOTAL_STEPS} current={step} />

      <div className="flex-1">
        {step === 0 && (
          <Step title="Your strength goal" subtitle="This shapes which sessions you'll get.">
            <div className="flex flex-col gap-3">
              {GOALS.map((g) => (
                <SelectCard key={g.value} active={goal === g.value} title={g.label} hint={g.hint} onClick={() => setGoal(g.value)} />
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Experience level" subtitle="We'll match the difficulty.">
            <div className="flex flex-col gap-3">
              {EXPERIENCE.map((e) => (
                <SelectCard key={e.value} active={experienceLevel === e.value} title={e.label} hint={e.hint} onClick={() => setExperienceLevel(e.value)} />
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="What equipment do you have?" subtitle="Pick any that apply — sessions adapt to bodyweight otherwise.">
            <div className="flex flex-col gap-2">
              {EQUIPMENT.map((e) => (
                <MultiSelectCard
                  key={e.value}
                  active={e.value === 'none' ? true : equipment.includes(e.value)}
                  title={e.label}
                  hint={e.hint}
                  onClick={() => toggleEquipment(e.value)}
                />
              ))}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Session length" subtitle="How long do you want each session?">
            <Segmented
              options={[
                { value: '20', label: '20 min' },
                { value: '30', label: '30 min' },
                { value: '45', label: '45 min' },
              ]}
              value={String(sessionLengthMinutes)}
              onChange={(v) => setSessionLength(Number(v) as 20 | 30 | 45)}
            />
          </Step>
        )}

        {step === 4 && (
          <Step title="How often per week?" subtitle="We'll place these around your runs.">
            <Segmented
              options={[
                { value: '1', label: '1× / week' },
                { value: '2', label: '2× / week' },
                { value: '3', label: '3× / week' },
              ]}
              value={String(frequencyPerWeek)}
              onChange={(v) => setFrequency(Number(v) as 1 | 2 | 3)}
            />
          </Step>
        )}
      </div>

      <div className="flex gap-3 pt-6">
        {step > 0 && (
          <button className="btn-ghost flex-1" onClick={() => setStep((p) => p - 1)} disabled={submitting}>
            Back
          </button>
        )}
        {!isLast ? (
          <button className="btn-primary flex-1" onClick={() => setStep((p) => p + 1)}>
            Next
          </button>
        ) : (
          <button className="btn-primary flex-1" disabled={submitting} onClick={() => finish()}>
            {submitting ? 'Adding…' : 'Add to my plan'}
          </button>
        )}
      </div>
    </div>
  )
}
