import { useState, useEffect } from 'react'
import { isOnline, onConnectivityChange } from '@/lib/offline'

/**
 * Hook that returns whether the device is currently online.
 * Updates in real-time as connectivity changes.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(isOnline())

  useEffect(() => {
    return onConnectivityChange(setOnline)
  }, [])

  return online
}
