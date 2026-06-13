import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useChatSocket } from './useChatSocket'

export type CallStatus = 'IDLE' | 'CALLING' | 'RINGING' | 'CONNECTED'

interface IncomingCallData {
  conversationId: string
  callerId: string
  mediaType: 'audio' | 'video'
  offer: RTCSessionDescriptionInit
  callerName?: string
  callerAvatar?: string | null
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

// Timeout avant raccroché automatique (en millisecondes)
const CALLER_TIMEOUT_MS = 45_000  // 45s côté appelant
const RINGING_TIMEOUT_MS = 60_000 // 60s côté receveur

export function useWebRTC() {
  const { user } = useAuthStore()
  const { sendSignal, sendMessage } = useChatSocket()

  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE')
  const callStatusRef = useRef<CallStatus>('IDLE')
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [outgoingCall, setOutgoingCall] = useState<{ targetName?: string, targetAvatar?: string | null } | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  
  // Track active call details
  const activeConversationId = useRef<string | null>(null)
  const incomingCallRef = useRef<IncomingCallData | null>(null)
  const isVideoEnabled = useRef<boolean>(true)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  
  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  // Timers
  const callerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAllTimers = useCallback(() => {
    if (callerTimeoutRef.current) {
      clearTimeout(callerTimeoutRef.current)
      callerTimeoutRef.current = null
    }
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current)
      ringingTimeoutRef.current = null
    }
  }, [])

  // Initialize WebRTC Peer Connection
  const createPeerConnection = useCallback((conversationId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice_candidate',
          conversationId,
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0])
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall(conversationId, false)
      }
    }

    peerConnection.current = pc
    return pc
  }, [sendSignal])

  // Get User Media
  const getMedia = async (mediaType: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaType === 'video' ? { facingMode: 'user' } : false,
      })
      setLocalStream(stream)
      localStreamRef.current = stream
      isVideoEnabled.current = mediaType === 'video'
      return stream
    } catch (error: any) {
      console.error('Error accessing media devices.', error)
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        import('sonner').then(({ toast }) => {
          toast.error(mediaType === 'video'
            ? 'Accès à la caméra et au micro refusé. Ouverture des paramètres...'
            : 'Accès au microphone refusé. Ouverture des paramètres...')
        })
        setTimeout(() => {
          import('capacitor-native-settings').then(({ NativeSettings, AndroidSettings, IOSSettings }) => {
            NativeSettings.open({
              optionAndroid: AndroidSettings.ApplicationDetails,
              optionIOS: IOSSettings.App
            }).catch(e => console.error(e))
          }).catch(e => console.error(e))
        }, 1500)
      } else if (error?.name === 'NotFoundError') {
        import('sonner').then(({ toast }) => {
          toast.error(mediaType === 'video'
            ? 'Aucune caméra ou microphone trouvé sur cet appareil.'
            : 'Aucun microphone trouvé sur cet appareil.')
        })
      } else {
        import('sonner').then(({ toast }) => {
          toast.error("Impossible d'accéder aux périphériques audio/vidéo.")
        })
      }
      return null
    }
  }

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebRTC] cleanup')
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
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
    setRemoteStream(null)
    setIncomingCall(null)
    setOutgoingCall(null)
    setCallStatus('IDLE')
    clearAllTimers()
  }, [clearAllTimers])

  // End Call
  const endCall = useCallback((conversationId: string, emit = true) => {
    if (emit) {
      sendSignal({ type: 'call_end', conversationId })
    }
    cleanup()
  }, [cleanup, sendSignal])

  // Reject Call
  const rejectCall = useCallback((conversationId: string) => {
    clearAllTimers()
    sendSignal({ type: 'call_reject', conversationId })
    
    if (activeConversationId.current) {
      import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
        IncomingCallKit.endCall({ callId: activeConversationId.current! }).catch(() => {})
      }).catch(() => {})
    }
    
    activeConversationId.current = null
    incomingCallRef.current = null
    setIncomingCall(null)
    setOutgoingCall(null)
    setCallStatus('IDLE')
  }, [sendSignal, clearAllTimers])

  // Start Call (Caller)
  const startCall = useCallback(async (conversationId: string, targetUserId: string, mediaType: 'audio' | 'video', targetName?: string, targetAvatar?: string | null) => {
    if (!user) return
    if (!targetUserId) {
      console.error('[WebRTC] startCall: targetUserId manquant !')
      import('sonner').then(({ toast }) => toast.error('Impossible de démarrer l\'appel : destinataire introuvable.'))
      return
    }

    console.log('[WebRTC] startCall →', { conversationId, targetUserId, mediaType })
    
    setCallStatus('CALLING')
    setOutgoingCall({ targetName, targetAvatar })
    activeConversationId.current = conversationId

    // Notify peer we are starting a call
    const sent1 = sendSignal({
      type: 'call_start',
      conversationId,
      callerId: user.id,
      targetUserId,
      mediaType,
    })
    console.log('[WebRTC] call_start envoyé:', sent1)

    const stream = await getMedia(mediaType)
    if (!stream) {
      setTimeout(() => cleanup(), 2500)
      return
    }

    // Send a system message to the chat
    sendMessage(conversationId, `📞 Appel ${mediaType === 'video' ? 'vidéo' : 'audio'}`, 'SYSTEM')

    const pc = createPeerConnection(conversationId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sent2 = sendSignal({
        type: 'call_offer',
        conversationId,
        targetUserId,
        offer,
        mediaType,
        callerName: user.profile?.displayName || user.email || 'Appel entrant',
        callerAvatar: user.profile?.avatarUrl || null
      })
      console.log('[WebRTC] call_offer envoyé:', sent2, '— conversationId:', conversationId, '— targetUserId:', targetUserId)

      if (!sent2) {
        import('sonner').then(({ toast }) => toast.error('Erreur réseau : impossible d\'envoyer l\'appel. Réessaie dans un instant.'))
        cleanup()
        return
      }

      // ── Timeout côté appelant : 45 secondes sans réponse ──────────────────
      callerTimeoutRef.current = setTimeout(() => {
        // Vérifier qu'on est encore en train d'appeler (pas connecté)
        setCallStatus(prev => {
          if (prev === 'CALLING') {
            sendSignal({ type: 'call_end', conversationId })
            cleanup()
            import('sonner').then(({ toast }) => {
              toast.info('Appel sans réponse')
            })
          }
          return prev
        })
      }, CALLER_TIMEOUT_MS)

    } catch (e) {
      console.error('Error creating offer', e)
      cleanup()
    }
  }, [user, sendSignal, createPeerConnection, cleanup, clearAllTimers])

  // Accept Call (Receiver)
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return

    clearAllTimers() // Annule le timer de sonnerie
    setCallStatus('CONNECTED')
    activeConversationId.current = incomingCall.conversationId

    const stream = await getMedia(incomingCall.mediaType)
    if (!stream) {
      rejectCall(incomingCall.conversationId)
      cleanup()
      return
    }

    const pc = createPeerConnection(incomingCall.conversationId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      sendSignal({
        type: 'call_answer',
        conversationId: incomingCall.conversationId,
        targetUserId: incomingCall.callerId,
        answer,
      })
    } catch (e) {
      console.error('Error creating answer', e)
      cleanup()
    }
  }, [incomingCall, createPeerConnection, rejectCall, cleanup, sendSignal, clearAllTimers])

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      return stream.getAudioTracks()[0]?.enabled ?? false
    }
    return false
  }, [])

  // Toggle Video
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      return stream.getVideoTracks()[0]?.enabled ?? false
    }
    return false
  }, [])

  // Handle incoming signaling messages
  useEffect(() => {
    import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
      IncomingCallKit.addListener('callAccepted', (call) => {
        console.log('[Native] callAccepted', call)
        // L'utilisateur a décroché depuis l'écran natif
        if (incomingCallRef.current) {
          acceptCall()
        }
      })
      
      IncomingCallKit.addListener('callDeclined', (call) => {
        console.log('[Native] callDeclined', call)
        // L'utilisateur a raccroché depuis l'écran natif
        if (incomingCallRef.current) {
          rejectCall(incomingCallRef.current.conversationId)
        }
      })
    }).catch(err => console.error('IncomingCallKit not available', err))

    const handleSignal = async (e: Event) => {
      const data = (e as CustomEvent).detail
      
      // If we are not the target of this specific P2P message (useful in groups)
      if (data.targetUserId && user && data.targetUserId !== user.id) return

      // Do not process our own broadcasted signals
      if (data.userId === user?.id) return

      switch (data.type) {
        case 'call_start':
          // Optional: We can show ringing earlier here if needed
          break
        case 'call_offer':
          if (callStatusRef.current === 'IDLE' || callStatusRef.current === 'CALLING') {
            setIncomingCall(data)
            incomingCallRef.current = data
            setCallStatus('RINGING')
            
            // Afficher l'écran natif si on est sur mobile
            import('@capgo/capacitor-incoming-call-kit').then(({ IncomingCallKit }) => {
              IncomingCallKit.showIncomingCall({
                callId: data.conversationId,
                callerName: data.callerName || 'Appel entrant',
                hasVideo: data.mediaType === 'video'
              }).catch(err => console.error('showIncomingCall error', err))
            }).catch(() => {})
            
            // Set 60s timeout for ringing
            ringingTimeoutRef.current = setTimeout(() => {
                setCallStatus(currentStatus => {
                  if (currentStatus === 'RINGING') {
                    sendSignal({ type: 'call_reject', conversationId: data.conversationId })
                    setIncomingCall(null)
                    return 'IDLE'
                  }
                  return currentStatus
                })
              }, RINGING_TIMEOUT_MS)
          } else {
            // Already in a call, reject automatically
            sendSignal({ type: 'call_reject', conversationId: data.conversationId, targetUserId: data.userId })
          }
          break
        case 'call_answer':
          if (peerConnection.current) {
            clearAllTimers() // L'appelé a décroché, annuler le timeout
            setCallStatus(prev => {
              if (prev === 'CALLING') {
                peerConnection.current!.setRemoteDescription(new RTCSessionDescription(data.answer))
                  .catch(err => console.error('Error setting remote description', err))
                return 'CONNECTED'
              }
              return prev
            })
          }
          break
        case 'ice_candidate':
          if (peerConnection.current) {
            try {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate))
            } catch (err) {
              console.error('Error adding ICE candidate', err)
            }
          }
          break
        case 'call_reject':
          if (activeConversationId.current === data.conversationId) {
            clearAllTimers()
            cleanup()
            import('sonner').then(({ toast }) => {
              toast.info('Appel refusé')
            })
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
    }
  }, [user, sendSignal, cleanup, startCall, clearAllTimers])

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
