/**
 * WebSocket Singleton — une seule connexion WS partagée dans toute l'app.
 *
 * PROBLÈME résolu : auparavant, chaque composant qui appelait useChatSocket()
 * créait sa propre connexion WebSocket. Résultat : useWebRTC (dans CallOverlay)
 * envoyait les signaux via un WS différent de celui qui recevait les messages,
 * et les signaux pouvaient être perdus si la connexion n'était pas encore établie.
 *
 * SOLUTION : un seul WebSocket maintenu ici. Tous les composants partagent la
 * même connexion via useChatSocket().
 */

import { useAuthStore } from '@/stores/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'

// ─── Singleton WebSocket ────────────────────────────────────────────────────
let globalWs: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let currentToken: string | null = null

// Registry of message handlers (all useChatSocket instances register here)
type MessageHandler = (data: any) => void
const messageHandlers = new Set<MessageHandler>()

function getWsUrl(token: string): string {
  let wsUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined
  if (wsUrl && (wsUrl.includes('localhost') || wsUrl.includes('127.0.0.1') || wsUrl.includes('172.30.') || wsUrl.includes('192.168.'))) {
    // Local dev config from env, keep it
  } else {
    if (typeof window !== 'undefined' && window.location?.origin) {
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
  return `${wsUrl}/api/v1/chat/ws?token=${token}`
}

function connectGlobal(token: string) {
  // Already connected with the same token
  if (globalWs?.readyState === WebSocket.OPEN && currentToken === token) return
  // Close stale connection
  if (globalWs) {
    globalWs.onclose = null // prevent auto-reconnect on manual close
    globalWs.close()
    globalWs = null
  }

  currentToken = token
  const url = getWsUrl(token)
  const ws = new WebSocket(url)
  globalWs = ws

  ws.onopen = () => {
    console.log('[WS Global] Connected')
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      messageHandlers.forEach(handler => {
        try { handler(data) } catch (e) { console.error('[WS] handler error', e) }
      })
    } catch { /* ignore */ }
  }

  ws.onclose = () => {
    globalWs = null
    // Don't reconnect if token changed or expired
    const latestToken = useAuthStore.getState().accessToken
    if (!latestToken) return
    try {
      const payload = JSON.parse(atob(latestToken.split('.')[1]))
      if (payload.exp && payload.exp * 1000 < Date.now()) return
    } catch { return }

    console.log('[WS Global] Disconnected — reconnecting in 5s')
    reconnectTimer = setTimeout(() => connectGlobal(latestToken), 5000)
  }

  ws.onerror = () => {
    ws.close()
  }
}

export function sendGlobal(payload: Record<string, any>): boolean {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(payload))
    return true
  }
  console.warn('[WS Global] Cannot send — WebSocket not open. State:', globalWs?.readyState)
  return false
}

// ─── React hook ─────────────────────────────────────────────────────────────
export function useChatSocket() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const handlerRef = useRef<MessageHandler | null>(null)

  // Connect (or reuse) the global WebSocket whenever token changes
  useEffect(() => {
    if (!token) return
    connectGlobal(token)
  }, [token])

  // Register this hook's message handler
  useEffect(() => {
    const handler: MessageHandler = (data) => {
      if (data.type === 'new_message') {
        qc.invalidateQueries({ queryKey: ['chat', 'messages', data.message.conversationId] })
        qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      }

      if (data.type === 'reaction_update') {
        qc.invalidateQueries({ queryKey: ['chat', 'messages', data.conversationId] })
      }

      if (data.type === 'typing') {
        window.dispatchEvent(new CustomEvent('ws:typing', {
          detail: { conversationId: data.conversationId, displayName: data.displayName }
        }))
      }

      if (data.type === 'notification:new') {
        qc.invalidateQueries({ queryKey: ['notifications'] })
        qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      }

      // WebRTC Signaling → forward via window event
      if (['call_start', 'call_offer', 'call_answer', 'ice_candidate', 'call_reject', 'call_end'].includes(data.type)) {
        window.dispatchEvent(new CustomEvent('ws:webrtc', { detail: data }))
      }
    }

    handlerRef.current = handler
    messageHandlers.add(handler)
    return () => {
      messageHandlers.delete(handler)
    }
  }, [qc])

  const send = useCallback((payload: Record<string, any>) => {
    return sendGlobal(payload)
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
      send({ type: 'read', conversationId, messageId }),
    [send],
  )

  const sendSignal = useCallback(
    (payload: Record<string, any>) => send(payload),
    [send]
  )

  return { sendMessage, sendTyping, sendRead, sendSignal, isConnected: globalWs?.readyState === WebSocket.OPEN }
}
