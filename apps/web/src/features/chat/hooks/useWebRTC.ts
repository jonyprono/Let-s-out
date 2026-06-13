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

  // ── Refs: never go stale in closures ────────────────────────────────────────
  const callStatusRef = useRef<CallStatus>('IDLE')
  const activeConversationId = useRef<string | null>(null)
  const incomingCallRef = useRef<IncomingCallData | null>(null)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([])
  const isVideoEnabled = useRef<boolean>(true)
  const callerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep live references to functions so signal handlers never get stale
  const userRef = useRef(user)
  const sendSignalRef = useRef(sendSignal)
  const sendMessageRef = useRef(sendMessage)

  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { sendSignalRef.current = sendSignal }, [sendSignal])
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── updateCallStatus ──────────────────────────────────────────────────────────
  const updateCallStatus = useCallback((status: CallStatus) => {
    callStatusRef.current = status
    setCallStatus(status)
  }, [])

  // ── clearAllTimers ────────────────────────────────────────────────────────────
  const clearAllTimers = useCallback(() => {
    if (callerTimeoutRef.current) { clearTimeout(callerTimeoutRef.current); callerTimeoutRef.current = null }
    if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null }
  }, [])

  // ── cleanup ───────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    console.log('[WebRTC] cleanup, status was:', callStatusRef.current)
    clearAllTimers()
    if (peerConnection.current) {
      peerConnection.current.ontrack = null
      peerConnection.current.onicecandidate = null
      peerConnection.current.oniceconnectionstatechange = null
      peerConnection.current.onconnectionstatechange = null
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
    setLocalStream(null)
    setRemoteStream(null)
    setIncomingCall(null)
    setOutgoingCall(null)
    updateCallStatus('IDLE')
  }, [clearAllTimers, updateCallStatus])

  // ── getMedia ──────────────────────────────────────────────────────────────────
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

  // ── flushIceCandidates ────────────────────────────────────────────────────────
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

  // ── createPeerConnection ──────────────────────────────────────────────────────
  const createPeerConnection = useCallback((conversationId: string): RTCPeerConnection => {
    if (peerConnection.current) {
      peerConnection.current.ontrack = null
      peerConnection.current.onicecandidate = null
      peerConnection.current.close()
    }
    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnection.current = pc

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalRef.current({ type: 'ice_candidate', conversationId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack fired, streams:', event.streams?.length)
      if (event.streams && event.streams[0]) {
        // Clone the stream to force React state update and re-create the DOM element
        setRemoteStream(new MediaStream(event.streams[0].getTracks()))
      } else if (event.track) {
        setRemoteStream(prev => {
          if (prev) {
            const newStream = new MediaStream(prev.getTracks())
            newStream.addTrack(event.track)
            return newStream
          }
          return new MediaStream([event.track])
        })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState, '| callStatus:', callStatusRef.current)
      // Only monitor after the call is fully connected
      if (callStatusRef.current !== 'CONNECTED') return

      if (pc.connectionState === 'connected') {
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null }
      } else if (pc.connectionState === 'failed') {
        sendSignalRef.current({ type: 'call_end', conversationId })
        cleanup()
      } else if (pc.connectionState === 'disconnected') {
        disconnectTimerRef.current = setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            sendSignalRef.current({ type: 'call_end', conversationId })
            cleanup()
          }
        }, 6000)
      }
    }

    return pc
  }, [cleanup])

  // ── endCall ───────────────────────────────────────────────────────────────────
  const endCall = useCallback((conversationId: string, emit = true) => {
    if (emit) sendSignalRef.current({ type: 'call_end', conversationId })
    cleanup()
  }, [cleanup])

  // ── rejectCall ────────────────────────────────────────────────────────────────
  const rejectCall = useCallback((conversationId: string) => {
    sendSignalRef.current({ type: 'call_reject', conversationId })
    cleanup()
  }, [cleanup])

  // ── startCall ─────────────────────────────────────────────────────────────────
  const startCall = useCallback(async (
    conversationId: string,
    targetUserId: string,
    mediaType: 'audio' | 'video',
    targetName?: string,
    targetAvatar?: string | null
  ) => {
    const currentUser = userRef.current
    if (!currentUser || !targetUserId) return
    console.log('[WebRTC] startCall →', { conversationId, targetUserId, mediaType })

    updateCallStatus('CALLING')
    setOutgoingCall({ targetName, targetAvatar })
    activeConversationId.current = conversationId

    sendSignalRef.current({ type: 'call_start', conversationId, callerId: currentUser.id, targetUserId, mediaType })

    const stream = await getMedia(mediaType)
    if (!stream) { setTimeout(cleanup, 2500); return }

    sendMessageRef.current(conversationId, `📞 Appel ${mediaType === 'video' ? 'vidéo' : 'audio'}`, 'SYSTEM')

    const pc = createPeerConnection(conversationId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const sent = sendSignalRef.current({
        type: 'call_offer',
        conversationId,
        targetUserId,
        offer,
        mediaType,
        callerName: currentUser.profile?.displayName || currentUser.email || 'Appel entrant',
        callerAvatar: currentUser.profile?.avatarUrl || null,
      })
      if (!sent) {
        import('sonner').then(({ toast }) => toast.error("Erreur réseau. Réessaie."))
        cleanup()
        return
      }
      callerTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'CALLING') {
          sendSignalRef.current({ type: 'call_end', conversationId })
          cleanup()
          import('sonner').then(({ toast }) => toast.info('Appel sans réponse'))
        }
      }, CALLER_TIMEOUT_MS)
    } catch (e) {
      console.error('[WebRTC] Error creating offer:', e)
      cleanup()
    }
  }, [updateCallStatus, getMedia, createPeerConnection, cleanup])

  // ── acceptCall ────────────────────────────────────────────────────────────────
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
      sendSignalRef.current({
        type: 'call_answer',
        conversationId: callData.conversationId,
        targetUserId: callData.callerId,
        answer,
      })
    } catch (e) {
      console.error('[WebRTC] Error creating answer:', e)
      cleanup()
    }
  }, [clearAllTimers, updateCallStatus, getMedia, createPeerConnection, rejectCall, flushIceCandidates, cleanup])

  // ── Toggle Mute / Video ───────────────────────────────────────────────────────
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

  // ── Signaling useEffect — runs ONCE (no function deps that change) ────────────
  // All functions are accessed via stable refs, so this effect never re-runs
  // during an active call, preventing listener removal during call setup.
  const acceptCallRef = useRef(acceptCall)
  const rejectCallRef = useRef(rejectCall)
  const startCallRef = useRef(startCall)
  const cleanupRef = useRef(cleanup)
  const clearAllTimersRef = useRef(clearAllTimers)
  const flushIceCandidatesRef = useRef(flushIceCandidates)
  const updateCallStatusRef = useRef(updateCallStatus)

  // Keep all function refs up to date without triggering useEffect re-runs
  useEffect(() => { acceptCallRef.current = acceptCall }, [acceptCall])
  useEffect(() => { rejectCallRef.current = rejectCall }, [rejectCall])
  useEffect(() => { startCallRef.current = startCall }, [startCall])
  useEffect(() => { cleanupRef.current = cleanup }, [cleanup])
  useEffect(() => { clearAllTimersRef.current = clearAllTimers }, [clearAllTimers])
  useEffect(() => { flushIceCandidatesRef.current = flushIceCandidates }, [flushIceCandidates])
  useEffect(() => { updateCallStatusRef.current = updateCallStatus }, [updateCallStatus])

  useEffect(() => {
    // Native CallKit listeners
    const callKitListeners: Array<{ remove: () => void }> = []
    import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
      const accepted = IncomingCallKit.addListener('callAccepted', () => {
        console.log('[Native] callAccepted, incomingCallRef:', incomingCallRef.current)
        acceptCallRef.current()
      })
      const declined = IncomingCallKit.addListener('callDeclined', () => {
        console.log('[Native] callDeclined')
        if (incomingCallRef.current) rejectCallRef.current(incomingCallRef.current.conversationId)
      })
      Promise.all([accepted, declined]).then(listeners => {
        callKitListeners.push(...listeners)
      })
    }).catch(() => {})

    const handleSignal = async (e: Event) => {
      const data = (e as CustomEvent).detail
      const currentUser = userRef.current

      // Ignore messages not targeting us
      if (data.targetUserId && currentUser && data.targetUserId !== currentUser.id) return
      // Ignore our own messages
      if (data.userId === currentUser?.id) return

      console.log('[WebRTC] Signal received:', data.type, '| callStatus:', callStatusRef.current)

      switch (data.type) {
        case 'call_offer':
          if (callStatusRef.current === 'IDLE') {
            incomingCallRef.current = data
            setIncomingCall(data)
            updateCallStatusRef.current('RINGING')
            activeConversationId.current = data.conversationId
            
            // On Android, showing the native call screen while the app is active 
            // can sometimes cause immediate rejection or conflicts.
            // Only trigger Native CallKit if we are not actively visible.
            if (document.visibilityState !== 'visible') {
              import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
                IncomingCallKit.showIncomingCall({
                  callId: data.conversationId,
                  callerName: data.callerName || 'Appel entrant',
                  hasVideo: data.mediaType === 'video',
                }).catch(err => console.error('showIncomingCall error', err))
              }).catch(() => {})
            }
            
            ringingTimeoutRef.current = setTimeout(() => {
              if (callStatusRef.current === 'RINGING') {
                sendSignalRef.current({ type: 'call_reject', conversationId: data.conversationId })
                cleanupRef.current()
              }
            }, RINGING_TIMEOUT_MS)
          } else if (
            // Duplicate offer for the same call we're already handling — ignore safely
            (callStatusRef.current === 'RINGING' || callStatusRef.current === 'CONNECTED') &&
            activeConversationId.current === data.conversationId
          ) {
            console.log('[WebRTC] Ignoring duplicate call_offer for same conversation')
          } else {
            // Genuinely busy with a different call — reject
            sendSignalRef.current({ type: 'call_reject', conversationId: data.conversationId, targetUserId: data.userId })
          }
          break

        case 'call_answer':
          if (peerConnection.current && callStatusRef.current === 'CALLING') {
            clearAllTimersRef.current()
            try {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer))
              await flushIceCandidatesRef.current(peerConnection.current)
              updateCallStatusRef.current('CONNECTED')
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
            clearAllTimersRef.current()
            cleanupRef.current()
            import('sonner').then(({ toast }) => toast.info('Appel refusé'))
          }
          break

        case 'call_end':
          if (activeConversationId.current === data.conversationId) {
            clearAllTimersRef.current()
            cleanupRef.current()
          }
          break
      }
    }

    const handleOutgoingCall = (e: Event) => {
      const { conversationId, targetUserId, mediaType, targetName, targetAvatar } = (e as CustomEvent).detail
      startCallRef.current(conversationId, targetUserId, mediaType, targetName, targetAvatar)
    }

    window.addEventListener('ws:webrtc', handleSignal)
    window.addEventListener('call:start_outgoing', handleOutgoingCall)

    return () => {
      window.removeEventListener('ws:webrtc', handleSignal)
      window.removeEventListener('call:start_outgoing', handleOutgoingCall)
      callKitListeners.forEach(l => l.remove())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps: runs once. All state/functions accessed via refs.

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
