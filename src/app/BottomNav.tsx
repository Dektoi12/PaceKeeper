import { NavLink, useNavigate } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Today', icon: '📅', end: true },
  { to: '/plan', label: 'Plan', icon: '🗓️', end: false },
  { to: '/stats', label: 'Stats', icon: '📊', end: false },
  { to: '/coach', label: 'Coach', icon: '🧠', end: false },
]

export function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-ink-800/95 backdrop-blur border-t border-ink-600 safe-bottom">
      <div className="relative grid grid-cols-5 items-center h-16 max-w-md mx-auto">
        {tabs.slice(0, 2).map((t) => (
          <Tab key={t.to} {...t} />
        ))}

        {/* Center FAB → Log */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/log')}
            aria-label="Log a run"
            className="w-14 h-14 -mt-6 rounded-full bg-accent-500 active:bg-accent-600 text-white text-2xl font-bold shadow-lg shadow-accent-500/30 flex items-center justify-center"
          >
            +
          </button>
        </div>

        {tabs.slice(2).map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}

function Tab({ to, label, icon, end }: { to: string; label: string; icon: string; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 h-full text-[11px] ${
          isActive ? 'text-accent-400' : 'text-slate-400'
        }`
      }
    >
      <span className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}
