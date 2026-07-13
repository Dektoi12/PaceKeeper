import type { Feel } from '@/services/db/types'

const FEELS: { value: Feel; emoji: string; label: string }[] = [
  { value: 1, emoji: '😣', label: 'Awful' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'OK' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

export function feelEmoji(feel?: Feel): string {
  return FEELS.find((f) => f.value === feel)?.emoji ?? '—'
}

export function FeelPicker({
  value,
  onChange,
}: {
  value?: Feel
  onChange: (feel: Feel) => void
}) {
  return (
    <div className="flex justify-between gap-2">
      {FEELS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition-colors ${
            value === f.value
              ? 'border-accent-500 bg-accent-500/15'
              : 'border-ink-600 bg-ink-700 active:bg-ink-600'
          }`}
        >
          <span className="text-2xl">{f.emoji}</span>
          <span className="text-[10px] text-slate-400">{f.label}</span>
        </button>
      ))}
    </div>
  )
}
