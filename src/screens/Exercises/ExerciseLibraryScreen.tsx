import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STRENGTH_LIBRARY, getExercise } from '@/services/strength'
import type { ExerciseCategory, StrengthExercise } from '@/services/strength'
import type { EquipmentType } from '@/services/db/types'
import { ExerciseDemo } from '@/components/demo/ExerciseDemo'
import { BottomSheet } from '@/components/BottomSheet'
import { ScreenHeader, EmptyState } from '@/components/ui'

/** Human labels for the equipment enum, in the order we like to show them. */
const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
  none: 'Bodyweight',
  resistanceBand: 'Band',
  dumbbells: 'Dumbbells',
  pullUpBar: 'Pull-up bar',
  gym: 'Gym',
}

/** Category filters. 'all' is synthetic; the rest match ExerciseCategory. */
const FILTERS: { value: 'all' | ExerciseCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'mobility', label: 'Mobility' },
]

/** Order categories appear in when showing "All". */
const CATEGORY_ORDER: ExerciseCategory[] = ['legs', 'core', 'push', 'pull', 'fullBody', 'mobility']
const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  legs: 'Legs',
  core: 'Core',
  push: 'Push',
  pull: 'Pull',
  fullBody: 'Full body',
  mobility: 'Mobility',
}

export function ExerciseLibraryScreen() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | ExerciseCategory>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = STRENGTH_LIBRARY.filter((e) => {
      if (filter !== 'all' && e.category !== filter) return false
      if (!q) return true
      return e.name.toLowerCase().includes(q) || e.primaryMuscles.some((m) => m.toLowerCase().includes(q))
    })
    // Group by category, preserving CATEGORY_ORDER.
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      items: matches.filter((e) => e.category === cat),
    })).filter((g) => g.items.length > 0)
  }, [filter, query])

  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups])

  return (
    <div className="px-4">
      <button onClick={() => navigate(-1)} className="text-slate-400 text-sm mt-3 mb-1">
        ‹ Back
      </button>
      <ScreenHeader
        title="Exercise library"
        subtitle={`${STRENGTH_LIBRARY.length} exercises · demos included`}
      />

      {/* Search */}
      <input
        type="search"
        inputMode="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or muscle…"
        className="w-full rounded-xl bg-ink-800 border border-ink-600 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent-500 mb-3"
      />

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? 'border-accent-500 bg-accent-500/10 text-accent-300'
                  : 'border-ink-600 text-slate-400'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {total === 0 ? (
        <EmptyState icon="🔍" title="No exercises found" hint="Try a different name, muscle, or category." />
      ) : (
        <div className="flex flex-col gap-5 mt-2">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {CATEGORY_LABEL[g.category]} · {g.items.length}
              </h2>
              <div className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <ExerciseRow key={e.id} exercise={e} onOpen={() => setOpenId(e.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ExerciseSheet exerciseId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

function ExerciseRow({ exercise, onOpen }: { exercise: StrengthExercise; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="card p-2.5 flex items-center gap-3 text-left active:bg-ink-700 transition-colors"
    >
      <ExerciseDemo exerciseId={exercise.id} size={56} className="shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100 truncate">{exercise.name}</p>
        <p className="text-xs text-slate-500 capitalize truncate">
          {exercise.primaryMuscles.join(' · ')}
        </p>
      </div>
      <span className="shrink-0 text-[11px] px-2 py-1 rounded-lg bg-ink-700 text-slate-400 capitalize">
        {exercise.difficulty}
      </span>
    </button>
  )
}

function ExerciseSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const exercise = exerciseId ? getExercise(exerciseId) : undefined
  return (
    <BottomSheet open={!!exercise} onClose={onClose} title={exercise?.name}>
      {exercise && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center">
            <ExerciseDemo exerciseId={exercise.id} size={150} />
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300 capitalize">
              {exercise.category}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300 capitalize">
              {exercise.difficulty}
            </span>
            <span className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300">
              {exercise.defaultSets} × {exercise.defaultReps}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Equipment
            </p>
            <div className="flex flex-wrap gap-2">
              {exercise.equipment.map((eq) => (
                <span key={eq} className="text-xs px-2 py-1 rounded-lg bg-ink-700 text-slate-300">
                  {EQUIPMENT_LABEL[eq]}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-300 mb-1.5">How to do it</p>
            <ol className="flex flex-col gap-1.5 list-decimal list-inside text-sm text-slate-300">
              {exercise.instructionSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>

          {exercise.commonMistakes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-session-tempo mb-1.5">Common mistakes</p>
              <ul className="flex flex-col gap-1 list-disc list-inside text-sm text-slate-400">
                {exercise.commonMistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
