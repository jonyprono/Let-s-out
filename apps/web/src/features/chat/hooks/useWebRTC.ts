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
      isVideoEnabled.current = mediaType === 'video'
      return stream
    } catch (error) {
      console.error('Error accessing media devices.', error)
      return null
    }
  }

  // Cleanup function
  const cleanup = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      setLocalStream(null)
    }
    setRemoteStream(null)
    setCallStatus('IDLE')
    setIncomingCall(null)
    activeConversationId.current = null
  }, [localStream])

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
      cleanup()
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
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      return localStream.getAudioTracks()[0]?.enabled ?? false
    }
    return false
  }, [localStream])

  // Toggle Video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled
      })
      return localStream.getVideoTracks()[0]?.enabled ?? false
    }
    return false
  }, [localStream])

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
          // Only handle if idle
          if (callStatus === 'IDLE') {
            setCallStatus('RINGING')
            setIncomingCall({
              conversationId: data.conversationId,
              callerId: data.userId, // The one who sent the offer
              mediaType: data.mediaType || 'audio',
              offer: data.offer,
            })
          } else {
            // Already in a call, reject automatically
            sendSignal({ type: 'call_reject', conversationId: data.conversationId, targetUserId: data.userId })
          }
          break
        case 'call_answer':
          if (peerConnection.current && callStatus === 'CALLING') {
            setCallStatus('CONNECTED')
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer))
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
  }, [callStatus, user, sendSignal, cleanup, startCall])

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
