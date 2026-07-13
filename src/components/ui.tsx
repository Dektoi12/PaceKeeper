import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={`card p-4 ${onClick ? 'active:bg-ink-700 transition-colors cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function Chip({
  children,
  color,
  className = '',
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${className}`}
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {children}
    </span>
  )
}

export function StatNumber({
  value,
  label,
  accent = false,
}: {
  value: ReactNode
  label: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col">
      <span className={`stat-number text-2xl ${accent ? 'text-accent-400' : 'text-slate-100'}`}>
        {value}
      </span>
      <span className="text-xs text-slate-400 mt-0.5">{label}</span>
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-slate-200 font-medium">{title}</p>
      {hint && <p className="text-slate-500 text-sm mt-1 max-w-xs">{hint}</p>}
    </div>
  )
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between px-4 pt-3 pb-2">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}
