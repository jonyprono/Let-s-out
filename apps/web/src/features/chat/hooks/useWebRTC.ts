import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useChatSocket } from './useChatSocket'

export type CallStatus = 'IDLE' | 'CALLING' | 'RINGING' | 'CONNECTED'

interface IncomingCallData {
  conversationId: string
  callerId: string
  mediaType: 'audio' | 'video'
  offer: RTCSessionDescriptionInit
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useWebRTC() {
  const { user } = useAuthStore()
  const { sendSignal } = useChatSocket()

  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE')
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  
  // Track active call details
  const activeConversationId = useRef<string | null>(null)
  const isVideoEnabled = useRef<boolean>(true)
  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

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
      // Show user-friendly error based on error type
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        import('sonner').then(({ toast }) => {
          toast.error(mediaType === 'video'
            ? 'Accès à la caméra et au micro refusé. Autorisez-les dans les paramètres.'
            : 'Accès au microphone refusé. Autorisez-le dans les paramètres.')
        })
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
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    setLocalStream(null)
    setRemoteStream(null)
    setCallStatus('IDLE')
    setIncomingCall(null)
    activeConversationId.current = null
  }, [])

  // End Call
  const endCall = useCallback((conversationId: string, emit = true) => {
    if (emit) {
      sendSignal({ type: 'call_end', conversationId })
    }
    cleanup()
  }, [cleanup, sendSignal])

  // Reject Call
  const rejectCall = useCallback((conversationId: string) => {
    sendSignal({ type: 'call_reject', conversationId })
    setIncomingCall(null)
  }, [sendSignal])

  // Start Call (Caller)
  const startCall = useCallback(async (conversationId: string, targetUserId: string, mediaType: 'audio' | 'video') => {
    if (!user) return
    
    setCallStatus('CALLING')
    activeConversationId.current = conversationId

    // Notify peer we are starting a call
    sendSignal({
      type: 'call_start',
      conversationId,
      callerId: user.id,
      targetUserId,
      mediaType,
    })

    const stream = await getMedia(mediaType)
    if (!stream) {
      // Keep CALLING state briefly so user sees the error toast, then cleanup
      setTimeout(() => cleanup(), 2500)
      return
    }

    const pc = createPeerConnection(conversationId)
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal({
        type: 'call_offer',
        conversationId,
        targetUserId,
        offer,
        mediaType
      })
    } catch (e) {
      console.error('Error creating offer', e)
      cleanup()
    }
  }, [user, sendSignal, createPeerConnection, cleanup])

  // Accept Call (Receiver)
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return

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
  }, [incomingCall, createPeerConnection, rejectCall, cleanup, sendSignal])

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
          setCallStatus(prev => {
            if (prev === 'IDLE') {
              setIncomingCall({
                conversationId: data.conversationId,
                callerId: data.userId,
                mediaType: data.mediaType || 'audio',
                offer: data.offer,
              })
              return 'RINGING'
            } else {
              // Already in a call, reject automatically
              sendSignal({ type: 'call_reject', conversationId: data.conversationId, targetUserId: data.userId })
              return prev
            }
          })
          break
        case 'call_answer':
          if (peerConnection.current) {
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
            cleanup()
          }
          break
        case 'call_end':
          if (activeConversationId.current === data.conversationId) {
            cleanup()
          }
          break
      }
    }

    const handleOutgoingCall = (e: Event) => {
      const { conversationId, targetUserId, mediaType } = (e as CustomEvent).detail
      startCall(conversationId, targetUserId, mediaType)
    }

    window.addEventListener('ws:webrtc', handleSignal)
    window.addEventListener('call:start_outgoing', handleOutgoingCall)
    
    return () => {
      window.removeEventListener('ws:webrtc', handleSignal)
      window.removeEventListener('call:start_outgoing', handleOutgoingCall)
    }
  }, [user, sendSignal, cleanup, startCall])

  return {
    callStatus,
    incomingCall,
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
