import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useWebRTC } from '../hooks/useWebRTC'
import { SafeImage } from '@/components/shared/SafeImage'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '../api'

// We pass the webrtc state as props or we use a global store,
// but since WebRTC is tied to the window event, we can just instantiate the hook here
// and render globally, OR instantiate it here and let it control itself.
// Let's create a wrapper that uses the hook.

export function CallOverlay() {
  const {
    callStatus,
    incomingCall,
    localStream,
    remoteStream,
    activeConversationId,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useWebRTC()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  // Fetch caller details if there's an incoming call
  const { data: conversation } = useQuery({
    queryKey: ['chat', 'conversations', incomingCall?.conversationId || activeConversationId],
    queryFn: () => chatApi.getConversation(incomingCall?.conversationId || activeConversationId!),
    enabled: !!(incomingCall?.conversationId || activeConversationId),
  })

  // Assign streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, callStatus])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream, callStatus])

  if (callStatus === 'IDLE') return null

  // UI for Incoming Call
  if (callStatus === 'RINGING' && incomingCall) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#1C1C1C] rounded-[32px] p-8 flex flex-col items-center w-[85%] max-w-[340px] shadow-2xl">
          <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden mb-6 ring-4 ring-white shadow-lg animate-pulse">
            <SafeImage
              src={conversation?.avatarUrl}
              alt="Caller"
              className="w-full h-full object-cover"
              fallback={<div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">?</div>}
            />
          </div>
          <h2 className="text-[22px] font-black text-gray-900 dark:text-white mb-2 text-center">
            {conversation?.name || 'Appel entrant'}
          </h2>
          <p className="text-[15px] font-medium text-gray-500 mb-8">
            Appel {incomingCall.mediaType === 'video' ? 'vidéo' : 'audio'}
          </p>

          <div className="flex items-center gap-6 w-full justify-center">
            <button
              onClick={() => rejectCall(incomingCall.conversationId)}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white active:scale-95 transition-transform shadow-[0_4px_20px_rgba(239,68,68,0.4)]"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white active:scale-95 transition-transform shadow-[0_4px_20px_rgba(34,197,94,0.4)] animate-bounce"
            >
              {incomingCall.mediaType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // UI for Active Call / Calling
  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A1A] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Remote Video / Main Area */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {remoteStream && remoteStream.getVideoTracks().length > 0 ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-gray-800 overflow-hidden mb-6 ring-4 ring-[#2A2A2A] shadow-2xl">
              <SafeImage
                src={conversation?.avatarUrl}
                alt="Caller"
                className="w-full h-full object-cover"
                fallback={<div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-500">?</div>}
              />
            </div>
            {callStatus === 'CALLING' && (
              <p className="text-white/70 font-medium text-lg animate-pulse">Appel en cours...</p>
            )}
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {localStream && localStream.getVideoTracks().length > 0 && !isVideoOff && (
          <div className="absolute top-safe-4 right-4 w-28 h-40 bg-black rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/20 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Header Overlay */}
        <div className="absolute top-safe-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full pointer-events-auto">
            <h3 className="text-white font-bold text-[15px]">{conversation?.name || 'Discussion'}</h3>
          </div>
          <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-2 animate-pulse" />
            <span className="text-white/90 font-medium text-[13px]">{callStatus === 'CALLING' ? 'Sonnerie' : '00:00'}</span>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="h-[120px] pb-safe-4 bg-[#1A1A1A] flex items-center justify-center gap-6 px-6 relative z-20">
        <button
          onClick={() => {
            const state = toggleMute()
            setIsMuted(!state)
          }}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isMuted ? 'bg-white text-black' : 'bg-[#2A2A2A] text-white hover:bg-[#3A3A3A]'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={() => endCall(activeConversationId!)}
          className="w-[72px] h-[72px] rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_4px_20px_rgba(239,68,68,0.4)] active:scale-95 transition-transform"
        >
          <PhoneOff className="w-8 h-8" />
        </button>

        <button
          onClick={() => {
            const state = toggleVideo()
            setIsVideoOff(!state)
          }}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${
            isVideoOff ? 'bg-white text-black' : 'bg-[#2A2A2A] text-white hover:bg-[#3A3A3A]'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>
      </div>
    </div>
  )
}
