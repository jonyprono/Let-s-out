import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react'
import { useWebRTC } from '../hooks/useWebRTC'
import { SafeImage } from '@/components/shared/SafeImage'
import { useQuery } from '@tanstack/react-query'
import { chatApi } from '../api'

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
  const [callDuration, setCallDuration] = useState(0)

  // Fetch caller/conversation details
  const convId = incomingCall?.conversationId || activeConversationId
  const { data: conversation } = useQuery({
    queryKey: ['chat', 'conversations', convId],
    queryFn: () => chatApi.getConversation(convId!),
    enabled: !!convId,
  })

  // Chronomètre — démarre quand l'appel est connecté
  useEffect(() => {
    if (callStatus !== 'CONNECTED') {
      setCallDuration(0)
      return
    }
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [callStatus])

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

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  if (callStatus === 'IDLE') return null

  // ─── Incoming Call Screen ──────────────────────────────────────────────────
  if (callStatus === 'RINGING' && incomingCall) {
    const callerName = conversation?.name || (incomingCall as any).callerName || 'Appel entrant'
    const callerAvatar = conversation?.avatarUrl || (incomingCall as any).callerAvatar || null
    const mediaLabel = incomingCall.mediaType === 'video' ? 'Appel vidéo' : 'Appel audio'

    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-between animate-in fade-in duration-300"
        style={{
          background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
        }}
      >
        {/* Top section */}
        <div className="flex flex-col items-center pt-20 flex-1 justify-center">
          {/* Pulsing rings */}
          <div className="relative mb-10">
            <div className="absolute inset-0 rounded-full bg-white/10 animate-ping scale-125" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-0 rounded-full bg-white/5 animate-ping scale-150" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            <div className="w-36 h-36 rounded-full overflow-hidden ring-4 ring-white/30 shadow-2xl relative">
              <SafeImage
                src={callerAvatar}
                alt={callerName}
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-white/60"
                    style={{ background: 'linear-gradient(135deg, #FF7A00, #FF4D8D)' }}>
                    {callerName.charAt(0).toUpperCase()}
                  </div>
                }
              />
            </div>
          </div>

          {/* Caller info */}
          <h2 className="text-3xl font-bold text-white mb-3 text-center tracking-tight">{callerName}</h2>
          <p className="text-white/60 text-base font-medium mb-2">{mediaLabel}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/50 text-sm">Sonnerie en cours...</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-16 pb-16 w-full">
          {/* Decline */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => rejectCall(incomingCall.conversationId)}
              className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #ff3a3a, #c0392b)' }}
            >
              <PhoneOff className="w-9 h-9 text-white" />
            </button>
            <span className="text-white/60 text-sm font-medium">Refuser</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={acceptCall}
              className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-2xl animate-bounce"
              style={{ background: 'linear-gradient(135deg, #00c851, #007E33)' }}
            >
              {incomingCall.mediaType === 'video'
                ? <Video className="w-9 h-9 text-white" />
                : <Phone className="w-9 h-9 text-white" />
              }
            </button>
            <span className="text-white/60 text-sm font-medium">Accepter</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── Active Call Screen ────────────────────────────────────────────────────
  const callerName = conversation?.name || 'Discussion'
  const callerAvatar = conversation?.avatarUrl || null
  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0
  const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0 && !isVideoOff

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col animate-in slide-in-from-bottom duration-300"
      style={{
        background: hasRemoteVideo
          ? '#000'
          : 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      }}
    >
      {/* ── Remote video / Avatar area ─────────────────────────────────── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-6">
            {/* Avatar */}
            <div className="w-40 h-40 rounded-full overflow-hidden ring-4 ring-white/20 shadow-2xl">
              <SafeImage
                src={callerAvatar}
                alt={callerName}
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center text-6xl font-bold"
                    style={{ background: 'linear-gradient(135deg, #FF7A00, #FF4D8D)' }}>
                    {callerName.charAt(0).toUpperCase()}
                  </div>
                }
              />
            </div>

            {/* Caller name + status */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
              {callStatus === 'CALLING' && (
                <div className="flex items-center justify-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-2 h-2 rounded-full bg-white/60 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-white/60 text-sm ml-1">Sonnerie...</span>
                </div>
              )}
              {callStatus === 'CONNECTED' && (
                <span className="text-white/70 text-lg font-mono tabular-nums">
                  {formatDuration(callDuration)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Status bar (top overlay) ─────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-safe-4 pt-12 z-10">
          <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full">
            <span className="text-white font-semibold text-sm">{callerName}</span>
          </div>
          <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-full flex items-center gap-2">
            {callStatus === 'CONNECTED' && (
              <>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/90 font-mono text-sm tabular-nums">
                  {formatDuration(callDuration)}
                </span>
              </>
            )}
            {callStatus === 'CALLING' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-white/80 text-sm">Sonnerie</span>
              </>
            )}
          </div>
        </div>

        {/* ── Local video (PiP) ───────────────────────────────────── */}
        {hasLocalVideo && (
          <div className="absolute bottom-4 right-4 w-28 h-40 bg-black rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/20 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* ── Controls bar ───────────────────────────────────────────────── */}
      <div className="pb-safe-6 pb-10 pt-6 bg-black/60 backdrop-blur-md flex flex-col items-center gap-6 px-6">
        <div className="flex items-center justify-center gap-8">
          {/* Mute */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                const enabled = toggleMute()
                setIsMuted(!enabled)
              }}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                isMuted
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            <span className="text-white/60 text-xs font-medium">{isMuted ? 'Muet' : 'Micro'}</span>
          </div>

          {/* End call */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => endCall(activeConversationId!)}
              className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-transform"
              style={{ background: 'linear-gradient(135deg, #ff3a3a, #c0392b)' }}
            >
              <PhoneOff className="w-9 h-9" />
            </button>
            <span className="text-white/60 text-xs font-medium">Terminer</span>
          </div>

          {/* Video toggle */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                const enabled = toggleVideo()
                setIsVideoOff(!enabled)
              }}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                isVideoOff
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {isVideoOff ? <VideoOff className="w-7 h-7" /> : <Video className="w-7 h-7" />}
            </button>
            <span className="text-white/60 text-xs font-medium">{isVideoOff ? 'Caméra off' : 'Caméra'}</span>
          </div>
        </div>

        {/* Speaker hint when audio only */}
        {!hasRemoteVideo && callStatus === 'CONNECTED' && (
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Appel audio en cours</span>
          </div>
        )}
      </div>
    </div>
  )
}
