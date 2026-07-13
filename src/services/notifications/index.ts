import type { Session } from '@/services/db/types'
import { SESSION_META } from '@/services/planEngine'
import { formatDistance } from '@/lib/formatters'
import type { Units } from '@/services/db/types'

// Reminders (spec §7). Real background delivery needs Push or the experimental
// Notification Triggers API; iOS Safari PWAs support neither. So we do the
// honest thing: fire a notification when the app is open (Android/Chrome via the
// SW registration), and fall back to an in-app banner everywhere else. Callers
// decide the copy; this module handles capability + delivery.

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/**
 * Show a notification if we're allowed and able. Returns true if a system
 * notification was shown; false means the caller should use an in-app banner.
 */
export async function showReminder(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png' })
      return true
    }
    new Notification(title, { body, icon: '/pwa-192x192.png' })
    return true
  } catch {
    return false
  }
}

/** Copy for "today's run" and "tomorrow's run" reminders. */
export function sessionReminderText(session: Session, units: Units, when: 'today' | 'tomorrow'): { title: string; body: string } {
  const meta = SESSION_META[session.type]
  const dist = session.plannedDistanceKm ? ` · ${formatDistance(session.plannedDistanceKm, units)}` : ''
  return {
    title: when === 'today' ? 'Run scheduled today' : 'Tomorrow’s run',
    body: `${meta.label}: ${session.title}${dist}`,
  }
}
