import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'

type WsMessage =
  | { type: 'new_message'; message: any }
  | { type: 'typing'; userId: string; conversationId: string; displayName?: string }
  | { type: 'read'; userId: string; conversationId: string; messageId: string }
  | { type: 'reaction_update'; messageId: string; conversationId: string; reactions: any[] }
  | { type: 'notification:new'; notification: any }

type SendPayload =
  | { type: 'message'; conversationId: string; content: string; messageType?: string }
  | { type: 'typing'; conversationId: string }
  | { type: 'read'; conversationId: string; messageId: string }

export function useChatSocket() {
  const ws = useRef<WebSocket | null>(null)
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (!token) return
    if (ws.current?.readyState === WebSocket.OPEN) return

    let wsUrl = import.meta.env.VITE_WS_URL as string | undefined
    if (wsUrl && (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1') || wsUrl.includes('172.30.') || wsUrl.includes('192.168.'))) {
      // Local dev config from env, keep it
    } else {
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        const origin = window.location.origin
        if (origin.includes('vercel.app') || origin.includes('let-s-out-web')) {
          wsUrl = 'wss://let-s-out.onrender.com'
        } else if (origin.includes(':3000')) {
          wsUrl = origin.replace('http://', 'ws://').replace(':3000', ':3001')
        } else {
          wsUrl = origin.replace('http://', 'ws://').replace('https://', 'wss://')
        }
      } else {
        wsUrl = 'ws://localhost:3001'
      }
    }

    const url = `${wsUrl}/api/v1/chat/ws?token=${token}`
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      console.log('[WS] Connected')
      clearTimeout(reconnectTimer.current)
    }

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage

        if (data.type === 'new_message') {
          qc.invalidateQueries({ queryKey: ['chat', 'messages', data.message.conversationId] })
          qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
        }

        if (data.type === 'reaction_update') {
          qc.invalidateQueries({ queryKey: ['chat', 'messages', data.conversationId] })
        }

        if (data.type === 'typing') {
          // Dispatch a DOM event so ChatDetails can listen regardless of re-renders
          window.dispatchEvent(new CustomEvent('ws:typing', {
            detail: { conversationId: data.conversationId, displayName: data.displayName }
          }))
        }

        if (data.type === 'notification:new') {
          // Instantly refresh notification badge & list without waiting for polling
          qc.invalidateQueries({ queryKey: ['notifications'] })
          qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
        }

        // WebRTC Signaling
        if (['call_start', 'call_offer', 'call_answer', 'ice_candidate', 'call_reject', 'call_end'].includes(data.type)) {
          window.dispatchEvent(new CustomEvent('ws:webrtc', { detail: data }))
        }
      } catch {
        // ignore
      }
    }

    ws.current.onclose = () => {
      // Don't reconnect if the token is expired — wait for auth store to refresh it
      const token = useAuthStore.getState().accessToken
      if (!token) return

      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const isExpired = payload.exp && payload.exp * 1000 < Date.now()
        if (isExpired) return // Token expired — let the auth interceptor handle refresh
      } catch {
        // If we can't decode the token, don't reconnect
        return
      }

      console.log('[WS] Disconnected — reconnecting in 5s')
      reconnectTimer.current = setTimeout(connect, 5000)
    }

    ws.current.onerror = () => {
      ws.current?.close()
    }
  }, [token, qc])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const send = useCallback((payload: SendPayload) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload))
    }
  }, [])

  const sendMessage = useCallback(
    (conversationId: string, content: string, messageType: string = 'TEXT') =>
      send({ type: 'message', conversationId, content, messageType }),
    [send],
  )

  const sendTyping = useCallback(
    (conversationId: string) => send({ type: 'typing', conversationId }),
    [send],
  )

  const sendRead = useCallback(
    (conversationId: string, messageId: string) =>
      send({ type: 'read', conversationId, messageId } as any),
    [send],
  )

  const sendSignal = useCallback(
    (payload: Record<string, any>) => send(payload as any),
    [send]
  )

  return { sendMessage, sendTyping, sendRead, sendSignal, isConnected: ws.current?.readyState === WebSocket.OPEN }
}
