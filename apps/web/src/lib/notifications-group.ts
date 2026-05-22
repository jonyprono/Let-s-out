import type { Notification } from '@/features/notifications/api'

/** Notifications plus anciennes que cette durée sont masquées */
export const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

export function filterActiveNotifications(notifications: Notification[]): Notification[] {
  const cutoff = Date.now() - NOTIFICATION_TTL_MS
  return notifications.filter((n) => new Date(n.createdAt).getTime() >= cutoff)
}

export interface NotificationTypeGroup {
  type: string
  label: string
  count: number
  unreadCount: number
  latestAt: string
  latestTitle: string
}

export function groupNotificationsByType(
  notifications: Notification[],
  typeLabels: Record<string, string>,
): NotificationTypeGroup[] {
  const active = filterActiveNotifications(notifications)
  const map = new Map<string, Notification[]>()

  for (const n of active) {
    const list = map.get(n.type) ?? []
    list.push(n)
    map.set(n.type, list)
  }

  return Array.from(map.entries())
    .map(([type, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      const latest = sorted[0]
      return {
        type,
        label: typeLabels[type] ?? typeLabels.default ?? 'Notification',
        count: items.length,
        unreadCount: items.filter((i) => !i.isRead).length,
        latestAt: latest.createdAt,
        latestTitle: latest.title,
      }
    })
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime())
}

export function getNotificationsForType(
  notifications: Notification[],
  type: string,
): Notification[] {
  return filterActiveNotifications(notifications)
    .filter((n) => n.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
