import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useChatSocket } from './useChatSocket'
import { chatApi } from '../api'

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
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: '8e5cf94f4414232ce5b203a6',
      credential: 'IWaWq4jxX9Fqb6Zz'
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: '8e5cf94f4414232ce5b203a6',
      credential: 'IWaWq4jxX9Fqb6Zz'
    },
    {
      urls: 'turn:global.relay.metered.ca:443?transport=tcp',
      username: '8e5cf94f4414232ce5b203a6',
      credential: 'IWaWq4jxX9Fqb6Zz'
    }
  ],
}

const CALLER_TIMEOUT_MS = 45_000
const RINGING_TIMEOUT_MS = 60_000

export function useWebRTC() {
  const { user } = useAuthStore()
  const { sendSignal, sendMessage } = useChatSocket()

  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE')
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<{ targetName?: string; targetAvatar?: string | null; mediaType?: 'audio' | 'video' } | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())

  // ── Refs: never go stale in closures ────────────────────────────────────────
  const callStatusRef = useRef<CallStatus>('IDLE')
  const activeConversationId = useRef<string | null>(null)
  const incomingCallRef = useRef<IncomingCallData | null>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const iceCandidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const pendingOffers = useRef<Map<string, IncomingCallData>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const isVideoEnabled = useRef<boolean>(true)
  const callerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep live references to functions
  const userRef = useRef(user)
  const sendSignalRef = useRef(sendSignal)
  const sendMessageRef = useRef(sendMessage)

  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { sendSignalRef.current = sendSignal }, [sendSignal])
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  const updateCallStatus = useCallback((status: CallStatus) => {
    callStatusRef.current = status
    setCallStatus(status)
  }, [])

  const clearAllTimers = useCallback(() => {
    if (callerTimeoutRef.current) { clearTimeout(callerTimeoutRef.current); callerTimeoutRef.current = null }
    if (ringingTimeoutRef.current) { clearTimeout(ringingTimeoutRef.current); ringingTimeoutRef.current = null }
  }, [])

  const cleanup = useCallback(() => {
    console.log('[WebRTC] cleanup, status was:', callStatusRef.current)
    clearAllTimers()
    peerConnections.current.forEach(pc => {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.oniceconnectionstatechange = null
      pc.onconnectionstatechange = null
      pc.close()
    })
    peerConnections.current.clear()
    iceCandidateQueues.current.clear()
    pendingOffers.current.clear()

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
    setLocalStream(null)
    setRemoteStreams(new Map())
    setIncomingCall(null)
    setOutgoingCall(null)
    updateCallStatus('IDLE')
  }, [clearAllTimers, updateCallStatus])

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

  const flushIceCandidates = useCallback(async (targetUserId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueues.current.get(targetUserId) || []
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (e) {
        console.error(`[WebRTC] Failed to add queued ICE candidate for ${targetUserId}:`, e)
      }
    }
    iceCandidateQueues.current.set(targetUserId, [])
  }, [])

  const checkEndCallCondition = useCallback((conversationId: string) => {
    if (callStatusRef.current === 'CONNECTED' && peerConnections.current.size === 0) {
      sendSignalRef.current({ type: 'call_end', conversationId })
      cleanup()
    }
  }, [cleanup])

  const createPeerConnection = useCallback((conversationId: string, targetUserId: string): RTCPeerConnection => {
    if (peerConnections.current.has(targetUserId)) {
      peerConnections.current.get(targetUserId)!.close()
    }
    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnections.current.set(targetUserId, pc)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalRef.current({ type: 'ice_candidate', conversationId, targetUserId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack fired for ${targetUserId}, streams:`, event.streams?.length)
      const newStream = event.streams && event.streams[0]
        ? new MediaStream(event.streams[0].getTracks())
        : new MediaStream([event.track])
        
      setRemoteStreams(prev => {
        const next = new Map(prev)
        next.set(targetUserId, newStream)
        return next
      })
    }

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] connectionState for ${targetUserId}:`, pc.connectionState)
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        peerConnections.current.delete(targetUserId)
        setRemoteStreams(prev => {
          const next = new Map(prev)
          next.delete(targetUserId)
          return next
        })
        checkEndCallCondition(conversationId)
      }
    }

    return pc
  }, [checkEndCallCondition])

  const generateOffer = useCallback(async (conversationId: string, targetUserId: string, mediaType: 'audio' | 'video', stream: MediaStream) => {
    const pc = createPeerConnection(conversationId, targetUserId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      if (pc.iceGatheringState !== 'complete') {
        await new Promise<void>(resolve => {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState)
              resolve()
            }
          }
          pc.addEventListener('icegatheringstatechange', checkState)
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkState)
            resolve()
          }, 2500)
        })
      }

      const finalOffer = pc.localDescription || offer
      const currentUser = userRef.current!
      sendSignalRef.current({
        type: 'call_offer',
        conversationId,
        targetUserId,
        offer: finalOffer,
        mediaType,
        callerName: currentUser.profile?.displayName || currentUser.email || 'Appel entrant',
        callerAvatar: currentUser.profile?.avatarUrl || null,
      })
    } catch (e) {
      console.error('[WebRTC] Error creating offer for', targetUserId, e)
    }
  }, [createPeerConnection])

  const endCall = useCallback((conversationId: string, emit = true) => {
    if (emit) sendSignalRef.current({ type: 'call_end', conversationId })
    cleanup()
  }, [cleanup])

  const rejectCall = useCallback((conversationId: string) => {
    sendSignalRef.current({ type: 'call_reject', conversationId })
    cleanup()
  }, [cleanup])

  const startCall = useCallback(async (
    conversationId: string,
    _targetUserId: string | null,
    mediaType: 'audio' | 'video',
    targetName?: string,
    targetAvatar?: string | null
  ) => {
    const currentUser = userRef.current
    if (!currentUser) return
    console.log('[WebRTC] startCall →', { conversationId, mediaType })

    updateCallStatus('CALLING')
    setOutgoingCall({ targetName: targetName || 'Appel de groupe', targetAvatar, mediaType })
    activeConversationId.current = conversationId

    const stream = await getMedia(mediaType)
    if (!stream) { setTimeout(cleanup, 2500); return }

    sendMessageRef.current(conversationId, `📞 Appel ${mediaType === 'video' ? 'vidéo' : 'audio'} démarré`, 'SYSTEM')

    try {
      const res = await chatApi.getConversation(conversationId)
      const members = res.members.filter((m: any) => m.userId !== currentUser.id)
      
      for (const member of members) {
        sendSignalRef.current({ type: 'call_start', conversationId, callerId: currentUser.id, targetUserId: member.userId, mediaType })
        await generateOffer(conversationId, member.userId, mediaType, stream)
      }
      
      callerTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'CALLING') {
          sendSignalRef.current({ type: 'call_end', conversationId })
          cleanup()
          import('sonner').then(({ toast }) => toast.info('Appel sans réponse'))
        }
      }, CALLER_TIMEOUT_MS)
      
    } catch (e) {
      console.error('[WebRTC] Error fetching conversation members', e)
      cleanup()
    }
  }, [updateCallStatus, getMedia, generateOffer, cleanup])

  const acceptCall = useCallback(async () => {
    const currentUser = userRef.current
    if (!currentUser) return
    const callData = incomingCallRef.current || Array.from(pendingOffers.current.values())[0]
    if (!callData) { console.warn('[WebRTC] acceptCall: no incomingCallRef'); return }

    clearAllTimers()
    updateCallStatus('CONNECTED')
    activeConversationId.current = callData.conversationId

    const stream = localStreamRef.current || await getMedia(callData.mediaType)
    if (!stream) {
      rejectCall(callData.conversationId)
      return
    }

    try {
      // 1. Répondre à toutes les offres en attente
      for (const [callerId, offerData] of pendingOffers.current.entries()) {
        const pc = createPeerConnection(callData.conversationId, callerId)
        stream.getTracks().forEach(track => pc.addTrack(track, stream))
        await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer))
        await flushIceCandidates(callerId, pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendSignalRef.current({
          type: 'call_answer',
          conversationId: callData.conversationId,
          targetUserId: callerId,
          answer,
        })
      }
      pendingOffers.current.clear()

      // 2. Mesh P2P: Contacter les autres membres avec qui on n'a pas de connexion
      const res = await chatApi.getConversation(callData.conversationId)
      const members = res.members.filter((m: any) => m.userId !== currentUser.id)
      
      for (const member of members) {
        if (!peerConnections.current.has(member.userId) && currentUser.id < member.userId) {
          await generateOffer(callData.conversationId, member.userId, callData.mediaType, stream)
        }
      }
      
    } catch (e) {
      console.error('[WebRTC] Error accepting call:', e)
      cleanup()
    }
  }, [clearAllTimers, updateCallStatus, getMedia, createPeerConnection, flushIceCandidates, generateOffer, rejectCall, cleanup])

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

  const acceptCallRef = useRef(acceptCall)
  const rejectCallRef = useRef(rejectCall)
  const cleanupRef = useRef(cleanup)
  const clearAllTimersRef = useRef(clearAllTimers)
  const flushIceCandidatesRef = useRef(flushIceCandidates)
  const updateCallStatusRef = useRef(updateCallStatus)
  const createPeerConnectionRef = useRef(createPeerConnection)

  useEffect(() => { acceptCallRef.current = acceptCall }, [acceptCall])
  useEffect(() => { rejectCallRef.current = rejectCall }, [rejectCall])
  useEffect(() => { cleanupRef.current = cleanup }, [cleanup])
  useEffect(() => { clearAllTimersRef.current = clearAllTimers }, [clearAllTimers])
  useEffect(() => { flushIceCandidatesRef.current = flushIceCandidates }, [flushIceCandidates])
  useEffect(() => { updateCallStatusRef.current = updateCallStatus }, [updateCallStatus])
  useEffect(() => { createPeerConnectionRef.current = createPeerConnection }, [createPeerConnection])

  useEffect(() => {
    const callKitListeners: Array<{ remove: () => void }> = []
    import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
      const accepted = IncomingCallKit.addListener('callAccepted', () => {
        acceptCallRef.current()
      })
      const declined = IncomingCallKit.addListener('callDeclined', () => {
        if (incomingCallRef.current) rejectCallRef.current(incomingCallRef.current.conversationId)
      })
      Promise.all([accepted, declined]).then(listeners => {
        callKitListeners.push(...listeners)
      })
    }).catch(() => {})

    const handleSignal = async (e: Event) => {
      const data = (e as CustomEvent).detail
      const currentUser = userRef.current

      if (data.targetUserId && currentUser && data.targetUserId !== currentUser.id) return
      if (data.userId === currentUser?.id) return

      switch (data.type) {
        case 'call_offer':
          if (callStatusRef.current === 'IDLE' || callStatusRef.current === 'RINGING') {
            pendingOffers.current.set(data.userId, data)
            
            if (callStatusRef.current === 'IDLE') {
              incomingCallRef.current = data
              setIncomingCall(data)
              updateCallStatusRef.current('RINGING')
              activeConversationId.current = data.conversationId
              
              // Déclencher le ringtone natif même si app ouverte
              import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
                IncomingCallKit.showIncomingCall({
                  callId: data.conversationId,
                  callerName: data.callerName || 'Appel entrant',
                  hasVideo: data.mediaType === 'video',
                }).catch(() => {})
              }).catch(() => {})
              
              ringingTimeoutRef.current = setTimeout(() => {
                if (callStatusRef.current === 'RINGING') {
                  sendSignalRef.current({ type: 'call_reject', conversationId: data.conversationId })
                  cleanupRef.current()
                }
              }, RINGING_TIMEOUT_MS)
            }
          } else if (callStatusRef.current === 'CONNECTED' && activeConversationId.current === data.conversationId) {
            try {
              const stream = localStreamRef.current!
              const pc = createPeerConnectionRef.current(data.conversationId, data.userId)
              stream.getTracks().forEach(track => pc.addTrack(track, stream))
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
              await flushIceCandidatesRef.current(data.userId, pc)
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              sendSignalRef.current({
                type: 'call_answer',
                conversationId: data.conversationId,
                targetUserId: data.userId,
                answer,
              })
            } catch (err) {
              console.error('[WebRTC] Mesh auto-answer error:', err)
            }
          } else {
            sendSignalRef.current({ type: 'call_reject', conversationId: data.conversationId, targetUserId: data.userId })
          }
          break

        case 'call_answer':
          if (callStatusRef.current === 'CALLING' || callStatusRef.current === 'CONNECTED') {
            const pc = peerConnections.current.get(data.userId)
            if (pc) {
              clearAllTimersRef.current()
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
                await flushIceCandidatesRef.current(data.userId, pc)
                if (callStatusRef.current === 'CALLING') {
                  updateCallStatusRef.current('CONNECTED')
                }
              } catch (err) {
                console.error('[WebRTC] Error setting remote answer:', err)
              }
            }
          }
          break

        case 'ice_candidate':
          const pcIce = peerConnections.current.get(data.userId)
          if (pcIce && pcIce.remoteDescription) {
            pcIce.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {})
          } else {
            const queue = iceCandidateQueues.current.get(data.userId) || []
            queue.push(data.candidate)
            iceCandidateQueues.current.set(data.userId, queue)
          }
          break

        case 'call_reject':
        case 'call_end':
          if (data.conversationId === activeConversationId.current) {
             const pcToRemove = peerConnections.current.get(data.userId)
             if (pcToRemove) {
               pcToRemove.close()
               peerConnections.current.delete(data.userId)
               setRemoteStreams(prev => {
                 const next = new Map(prev)
                 next.delete(data.userId)
                 return next
               })
               if (callStatusRef.current === 'CONNECTED' && peerConnections.current.size === 0) {
                 cleanupRef.current()
               } else if (callStatusRef.current === 'CALLING') {
                 cleanupRef.current()
                 import('sonner').then(({ toast }) => toast.error('Appel refusé / terminé'))
               }
             } else if (callStatusRef.current === 'RINGING' || callStatusRef.current === 'CALLING') {
               cleanupRef.current()
             }
          }
          break
      }
    }

    window.addEventListener('ws:webrtc', handleSignal)
    return () => {
      window.removeEventListener('ws:webrtc', handleSignal)
      callKitListeners.forEach(l => l.remove())
    }
  }, [])

  return {
    callStatus,
    incomingCall,
    outgoingCall,
    activeConversationId: activeConversationId.current,
    localStream,
    remoteStreams,
    isVideoEnabled: isVideoEnabled.current,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo
  }
}
