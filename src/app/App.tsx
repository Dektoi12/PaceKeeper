import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, PROFILE_ID } from '@/services/db'
import { ToastProvider } from '@/components/Toast'
import { AppLayout } from './AppLayout'
import { TodayScreen } from '@/screens/Today/TodayScreen'
import { PlanScreen } from '@/screens/Plan/PlanScreen'
import { LogScreen } from '@/screens/Log/LogScreen'
import { StatsScreen } from '@/screens/Stats/StatsScreen'
import { CoachScreen } from '@/screens/Coach/CoachScreen'
import { OnboardingScreen } from '@/screens/Onboarding/OnboardingScreen'
import { SettingsScreen } from '@/screens/Settings/SettingsScreen'
import { SessionDetailScreen } from '@/screens/Plan/SessionDetailScreen'
import { RunDetailScreen } from '@/screens/Stats/RunDetailScreen'

export default function App() {
  const location = useLocation()
  // undefined = still loading; null = no profile (needs onboarding)
  const profile = useLiveQuery(() => db.profile.get(PROFILE_ID), [])
  const onboarded = profile !== undefined ? profile !== null : undefined

  if (onboarded === undefined) {
    return (
      <div className="min-h-full flex items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  const isOnboarding = location.pathname === '/onboarding'

  if (!onboarded && !isOnboarding) return <Navigate to="/onboarding" replace />
  if (onboarded && isOnboarding) return <Navigate to="/" replace />

  return (
    <ToastProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/log" element={<LogScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/coach" element={<CoachScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/session/:id" element={<SessionDetailScreen />} />
          <Route path="/run/:id" element={<RunDetailScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
