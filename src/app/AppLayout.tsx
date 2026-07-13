import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppLayout() {
  return (
    <div className="min-h-full max-w-md mx-auto flex flex-col">
      <main className="flex-1 pb-24 safe-top">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
