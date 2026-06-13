import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useChatSocket } from './useChatSocket'

export type CallStatus = 'IDLE' | 'CALLING' | 'RINGING' | 'CONNECTED'

export interface IncomingCallData {
  conversationId: string
  callerId: string
  mediaType: 'audio' | 'video'
  offer: RTCSessionDescriptionInit
  callerName?: string
  callerAvatar?: string | null
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
}

const CALLER_TIMEOUT_MS = 45_000
const RINGING_TIMEOUT_MS = 60_000

export function useWebRTC() {
  const { user } = useAuthStore()
  const { sendSignal, sendMessage } = useChatSocket()

  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE')
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<{ targetName?: string; targetAvatar?: string | null } | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  // Use refs for all mutable values to avoid stale closures
  const callStatusRef = useRef<CallStatus>('IDLE')
  const activeConversationId = useRef<string | null>(null)
  const incomingCallRef = useRef<IncomingCallData | null>(null)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([])
  const isVideoEnabled = useRef<boolean>(true)
  const callerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep callStatusRef in sync
  const updateCallStatus = useCallback((status: CallStatus) => {
    callStatusRef.current = status
    setCallStatus(status)
  }, [])

  const clearAllTimers = useCallback(() => {
    if (callerTimeoutRef.current) { clearTimeout(callerTimeoutRef.current); callerTimeoutRef.current = null }
    if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null }
  }, [])

  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    console.log('[WebRTC] cleanup')
    if (peerConnection.current) {
      peerConnection.current.ontrack = null
      peerConnection.current.onicecandidate = null
      peerConnection.current.oniceconnectionstatechange = null
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (activeConversationId.current) {
      import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
        IncomingCallKit.endCall({ callId: activeConversationId.current! }).catch(() => {})
      }).catch(() => {})
    }
    activeConversationId.current = null
    incomingCallRef.current = null
    iceCandidateQueue.current = []
    clearAllTimers()
    setLocalStream(null)
    setRemoteStream(null)
    setIncomingCall(null)
    setOutgoingCall(null)
    updateCallStatus('IDLE')
  }, [clearAllTimers, updateCallStatus])

  // ─── Get Media ───────────────────────────────────────────────────────────────
  const getMedia = useCallback(async (mediaType: 'audio' | 'video'): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaType === 'video' ? { facingMode: 'user' } : false,
      })
      localStreamRef.current = stream
      isVideoEnabled.current = mediaType === 'video'
      setLocalStream(stream)
      return stream
    } catch (error: any) {
      console.error('[WebRTC] getMedia error:', error)
      import('sonner').then(({ toast }) => {
        toast.error("Impossible d'accéder à la caméra/micro. Vérifie les permissions.")
      })
      return null
    }
  }, [])

  // ─── Create Peer Connection ───────────────────────────────────────────────────
  const createPeerConnection = useCallback((conversationId: string): RTCPeerConnection => {
    if (peerConnection.current) {
      peerConnection.current.close()
    }
    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnection.current = pc

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'ice_candidate', conversationId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired', event.streams)
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      } else if (event.track) {
        // Fallback: build a stream manually from the track
        const stream = new MediaStream([event.track])
        setRemoteStream(stream)
      }
    }

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        // Clear any pending disconnect timer if we reconnect
        if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null }
      } else if (pc.connectionState === 'failed') {
        // Hard failure — end the call immediately
        if (callStatusRef.current !== 'IDLE') {
          sendSignal({ type: 'call_end', conversationId })
          cleanup()
        }
      } else if (pc.connectionState === 'disconnected') {
        // Transient state during ICE setup or brief network blip — wait 6s before ending
        disconnectTimer = setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            if (callStatusRef.current !== 'IDLE') {
              sendSignal({ type: 'call_end', conversationId })
              cleanup()
            }
          }
        }, 6000)
      }
    }

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState)
    }

    return pc
  }, [sendSignal, cleanup])

  // ─── Flush ICE queue ─────────────────────────────────────────────────────────
  const flushIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queue = iceCandidateQueue.current.splice(0)
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (e) {
        console.error('[WebRTC] Failed to add queued ICE candidate:', e)
      }
    }
  }, [])

  // ─── End Call ────────────────────────────────────────────────────────────────
  const endCall = useCallback((conversationId: string, emit = true) => {
    if (emit) sendSignal({ type: 'call_end', conversationId })
    cleanup()
  }, [cleanup, sendSignal])

  // ─── Reject Call ─────────────────────────────────────────────────────────────
  const rejectCall = useCallback((conversationId: string) => {
    clearAllTimers()
    sendSignal({ type: 'call_reject', conversationId })
    cleanup()
  }, [sendSignal, clearAllTimers, cleanup])

  // ─── Start Call (Caller) ─────────────────────────────────────────────────────
  const startCall = useCallback(async (
    conversationId: string,
    targetUserId: string,
    mediaType: 'audio' | 'video',
    targetName?: string,
    targetAvatar?: string | null
  ) => {
    if (!user || !targetUserId) {
      console.error('[WebRTC] startCall: missing user or targetUserId')
      return
    }
    console.log('[WebRTC] startCall →', { conversationId, targetUserId, mediaType })

    updateCallStatus('CALLING')
    setOutgoingCall({ targetName, targetAvatar })
    activeConversationId.current = conversationId

    sendSignal({ type: 'call_start', conversationId, callerId: user.id, targetUserId, mediaType })

    const stream = await getMedia(mediaType)
    if (!stream) { setTimeout(cleanup, 2500); return }

    sendMessage(conversationId, `📞 Appel ${mediaType === 'video' ? 'vidéo' : 'audio'}`, 'SYSTEM')

    const pc = createPeerConnection(conversationId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const sent = sendSignal({
        type: 'call_offer',
        conversationId,
        targetUserId,
        offer,
        mediaType,
        callerName: user.profile?.displayName || user.email || 'Appel entrant',
        callerAvatar: user.profile?.avatarUrl || null,
      })
      if (!sent) {
        import('sonner').then(({ toast }) => toast.error("Erreur réseau. Réessaie."))
        cleanup()
        return
      }
      callerTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'CALLING') {
          sendSignal({ type: 'call_end', conversationId })
          cleanup()
          import('sonner').then(({ toast }) => toast.info('Appel sans réponse'))
        }
      }, CALLER_TIMEOUT_MS)
    } catch (e) {
      console.error('[WebRTC] Error creating offer:', e)
      cleanup()
    }
  }, [user, sendSignal, sendMessage, getMedia, createPeerConnection, cleanup, clearAllTimers, updateCallStatus])

  // ─── Accept Call (Receiver) ───────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    const callData = incomingCallRef.current
    if (!callData) { console.warn('[WebRTC] acceptCall: no incomingCallRef'); return }

    clearAllTimers()
    updateCallStatus('CONNECTED')
    activeConversationId.current = callData.conversationId

    const stream = await getMedia(callData.mediaType)
    if (!stream) {
      rejectCall(callData.conversationId)
      return
    }

    const pc = createPeerConnection(callData.conversationId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer))
      await flushIceCandidates(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal({
        type: 'call_answer',
        conversationId: callData.conversationId,
        targetUserId: callData.callerId,
        answer,
      })
    } catch (e) {
      console.error('[WebRTC] Error creating answer:', e)
      cleanup()
    }
  }, [clearAllTimers, updateCallStatus, getMedia, createPeerConnection, rejectCall, flushIceCandidates, sendSignal, cleanup])

  // ─── Toggle Mute / Video ─────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return false
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    return stream.getAudioTracks()[0]?.enabled ?? false
  }, [])

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return false
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    return stream.getVideoTracks()[0]?.enabled ?? false
  }, [])

  // ─── Signaling Event Handler ─────────────────────────────────────────────────
  useEffect(() => {
    // Native CallKit listeners
    const callKitListeners: Array<{ remove: () => void }> = []
    import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
      const accepted = IncomingCallKit.addListener('callAccepted', () => {
        console.log('[Native] callAccepted, ref:', incomingCallRef.current)
        acceptCall()
      })
      const declined = IncomingCallKit.addListener('callDeclined', () => {
        console.log('[Native] callDeclined')
        if (incomingCallRef.current) rejectCall(incomingCallRef.current.conversationId)
      })
      Promise.all([accepted, declined]).then(listeners => {
        callKitListeners.push(...listeners)
      })
    }).catch(() => {})

    const handleSignal = async (e: Event) => {
      const data = (e as CustomEvent).detail
      // Ignore messages not targeting us
      if (data.targetUserId && user && data.targetUserId !== user.id) return
      // Ignore our own messages
      if (data.userId === user?.id) return

      console.log('[WebRTC] Signal received:', data.type, data)

      switch (data.type) {
        case 'call_offer':
          if (callStatusRef.current === 'IDLE') {
            incomingCallRef.current = data
            setIncomingCall(data)
            updateCallStatus('RINGING')
            import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
              IncomingCallKit.showIncomingCall({
                callId: data.conversationId,
                callerName: data.callerName || 'Appel entrant',
                hasVideo: data.mediaType === 'video',
              }).catch(err => console.error('showIncomingCall error', err))
            }).catch(() => {})
            ringingTimeoutRef.current = setTimeout(() => {
              if (callStatusRef.current === 'RINGING') {
                sendSignal({ type: 'call_reject', conversationId: data.conversationId })
                cleanup()
              }
            }, RINGING_TIMEOUT_MS)
          } else {
            sendSignal({ type: 'call_reject', conversationId: data.conversationId, targetUserId: data.userId })
          }
          break

        case 'call_answer':
          if (peerConnection.current && callStatusRef.current === 'CALLING') {
            clearAllTimers()
            try {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer))
              await flushIceCandidates(peerConnection.current)
              updateCallStatus('CONNECTED')
            } catch (err) {
              console.error('[WebRTC] Error setting remote answer:', err)
            }
          }
          break

        case 'ice_candidate':
          if (peerConnection.current && peerConnection.current.remoteDescription) {
            try {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate))
            } catch (err) {
              console.error('[WebRTC] Error adding ICE candidate:', err)
            }
          } else {
            iceCandidateQueue.current.push(data.candidate)
          }
          break

        case 'call_reject':
          if (activeConversationId.current === data.conversationId) {
            clearAllTimers()
            cleanup()
            import('sonner').then(({ toast }) => toast.info('Appel refusé'))
          }
          break

        case 'call_end':
          if (activeConversationId.current === data.conversationId) {
            clearAllTimers()
            cleanup()
          }
          break
      }
    }

    const handleOutgoingCall = (e: Event) => {
      const { conversationId, targetUserId, mediaType, targetName, targetAvatar } = (e as CustomEvent).detail
      startCall(conversationId, targetUserId, mediaType, targetName, targetAvatar)
    }

    window.addEventListener('ws:webrtc', handleSignal)
    window.addEventListener('call:start_outgoing', handleOutgoingCall)

    return () => {
      window.removeEventListener('ws:webrtc', handleSignal)
      window.removeEventListener('call:start_outgoing', handleOutgoingCall)
      callKitListeners.forEach(l => l.remove())
    }
  }, [user, sendSignal, cleanup, startCall, acceptCall, rejectCall, clearAllTimers, updateCallStatus, flushIceCandidates])

  return {
    callStatus,
    incomingCall,
    outgoingCall,
    localStream,
    remoteStream,
    activeConversationId: activeConversationId.current,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  }
}
