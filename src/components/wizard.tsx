import type { ReactNode } from 'react'

// Shared one-question-per-screen wizard primitives, used by the onboarding and
// strength-onboarding flows.

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full flex-1 transition-colors ${
            i <= current ? 'bg-accent-500' : 'bg-ink-600'
          }`}
        />
      ))}
    </div>
  )
}

export function Step({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold tracking-tight mb-1">{title}</h1>
      {subtitle && <p className="text-slate-400 mb-5">{subtitle}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-slate-400">{label}</span>
      {children}
    </label>
  )
}

export function SelectCard({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean
  title: string
  hint: string
  onClick: () => void
}) {
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

export function Segmented({
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

/** Multi-select tappable chip grid (e.g. equipment). */
export function MultiSelectCard({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean
  title: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-card border transition-colors flex items-center justify-between gap-2 ${
        active ? 'border-accent-500 bg-accent-500/10' : 'border-ink-600 bg-ink-800 active:bg-ink-700'
      }`}
    >
      <div>
        <div className="font-semibold text-slate-100 text-sm">{title}</div>
        {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
      </div>
      <span
        className={`w-5 h-5 rounded-md border shrink-0 flex items-center justify-center text-xs ${
          active ? 'bg-accent-500 border-accent-500 text-white' : 'border-ink-500 text-transparent'
        }`}
      >
        ✓
      </span>
    </button>
  )
}
