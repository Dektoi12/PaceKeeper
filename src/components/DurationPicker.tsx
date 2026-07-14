import type { ReactNode } from 'react'

/**
 * Dropdown-based time entry. Replaces free-text "mm:ss" fields so there's
 * nothing to mistype — the value is always a valid number of seconds.
 * Hours are shown by default (runs/targets can exceed an hour); hide them
 * with `showHours={false}` to get a compact min:sec picker (e.g. for pace).
 */
export function DurationPicker({
  seconds,
  onChange,
  showHours = true,
  maxHours = 9,
}: {
  seconds: number
  onChange: (seconds: number) => void
  showHours?: boolean
  maxHours?: number
}) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  const update = (nh: number, nm: number, ns: number) => onChange(nh * 3600 + nm * 60 + ns)

  return (
    <div className="grid grid-flow-col auto-cols-fr gap-2">
      {showHours && (
        <Unit label="hrs">
          <NumberSelect
            ariaLabel="Hours"
            value={h}
            count={maxHours + 1}
            onChange={(v) => update(v, m, s)}
          />
        </Unit>
      )}
      <Unit label="min">
        <NumberSelect ariaLabel="Minutes" value={m} count={60} pad onChange={(v) => update(h, v, s)} />
      </Unit>
      <Unit label="sec">
        <NumberSelect ariaLabel="Seconds" value={s} count={60} pad onChange={(v) => update(h, m, v)} />
      </Unit>
    </div>
  )
}

function NumberSelect({
  value,
  count,
  onChange,
  ariaLabel,
  pad = false,
}: {
  value: number
  count: number
  onChange: (v: number) => void
  ariaLabel: string
  pad?: boolean
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input text-center cursor-pointer"
    >
      {Array.from({ length: count }, (_, n) => (
        <option key={n} value={n}>
          {pad ? String(n).padStart(2, '0') : n}
        </option>
      ))}
    </select>
  )
}

function Unit({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  )
}
