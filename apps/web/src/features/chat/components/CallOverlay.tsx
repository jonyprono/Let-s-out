import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react'
import { useWebRTC } from '../hooks/useWebRTC'
import { SafeImage } from '@/components/shared/SafeImage'

function useRingtone(callStatus: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio('/sounds/ringtone.wav')
      audio.loop = true
      audio.volume = 1.0
      audioRef.current = audio
    }
    const audio = audioRef.current
    if (callStatus === 'RINGING' || callStatus === 'CALLING') {
      audio.play().catch(() => {
        const resume = () => { audio.play().catch(() => {}); window.removeEventListener('touchstart', resume) }
        window.addEventListener('touchstart', resume, { once: true })
      })
    } else {
      audio.pause()
      audio.currentTime = 0
    }
    return () => { audio.pause(); audio.currentTime = 0 }
  }, [callStatus])
}

function RemoteVideoPlayer({ stream, mediaType, userName }: { stream: MediaStream, mediaType: 'audio'|'video', userName?: string }) {
  const mediaElementRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [needsUserTap, setNeedsUserTap] = useState(false)

  useEffect(() => {
    if (!stream || !containerRef.current) return
    let el = mediaElementRef.current
    if (!el) {
      if (mediaType === 'video') {
        const video = document.createElement('video')
        video.autoplay = true
        video.playsInline = true
        video.style.width = '100%'
        video.style.height = '100%'
        video.style.objectFit = 'cover'
        el = video
      } else {
        const audio = document.createElement('audio')
        audio.autoplay = true
        ;(audio as any).playsInline = true
        el = audio
      }
      mediaElementRef.current = el
      containerRef.current.appendChild(el)
    }

    if (el.srcObject !== stream) el.srcObject = stream

    el.play().then(() => setNeedsUserTap(false)).catch(err => {
      if (err.name === 'NotAllowedError') setNeedsUserTap(true)
    })

    return () => {
      el.pause()
      el.srcObject = null
      if (el.parentNode) el.parentNode.removeChild(el)
      mediaElementRef.current = null
    }
  }, [stream, mediaType])

  const hasVideo = stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled

  return (
    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden rounded-2xl shadow-xl border border-white/10">
      <div ref={containerRef} className={`w-full h-full absolute inset-0 ${!hasVideo ? 'opacity-0' : ''}`} />
      {needsUserTap && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60" onClick={() => mediaElementRef.current?.play().then(()=>setNeedsUserTap(false))}>
          <div className="flex flex-col items-center gap-2">
            <Volume2 className="w-10 h-10 text-white animate-pulse" />
            <span className="text-white/80 text-sm font-bold">Toucher pour activer le son</span>
          </div>
        </div>
      )}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
           <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-3">
             <span className="text-3xl font-bold text-white">{userName?.[0]?.toUpperCase() || '?'}</span>
           </div>
           <span className="text-white/80 font-medium px-4 py-1 bg-black/30 rounded-full backdrop-blur-sm">{userName || 'Participant'}</span>
        </div>
      )}
    </div>
  )
}

export function CallOverlay() {
  const {
    callStatus,
    incomingCall,
    outgoingCall,
    activeConversationId,
    localStream,
    remoteStreams,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useWebRTC()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  useRingtone(callStatus)

  const remoteMediaType = (incomingCall?.mediaType || outgoingCall?.mediaType || 'audio') === 'video' ? 'video' : 'audio'

  useEffect(() => {
    if (callStatus !== 'CONNECTED') { setCallDuration(0); return }
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000)
    return () => clearInterval(interval)
  }, [callStatus])

  useEffect(() => {
    if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  if (callStatus === 'IDLE') return null

  if (callStatus === 'RINGING' && incomingCall) {
    const callerName = incomingCall.callerName || 'Appel entrant'
    const callerAvatar = incomingCall.callerAvatar || null
    const mediaLabel = incomingCall.mediaType === 'video' ? 'Appel vidéo' : 'Appel audio'
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-between animate-in fade-in duration-300"
        style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' }}
      >
        <div className="flex flex-col items-center pt-20 flex-1 justify-center">
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
          <h2 className="text-3xl font-bold text-white mb-3 text-center tracking-tight">{callerName}</h2>
          <p className="text-white/60 text-base font-medium mb-2">{mediaLabel}</p>
        </div>
        <div className="flex items-center justify-center gap-16 pb-16 w-full">
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
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={acceptCall}
              className="w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-2xl animate-bounce"
              style={{ background: 'linear-gradient(135deg, #00c851, #007E33)' }}
            >
              {incomingCall.mediaType === 'video' ? <Video className="w-9 h-9 text-white" /> : <Phone className="w-9 h-9 text-white" />}
            </button>
            <span className="text-white/60 text-sm font-medium">Accepter</span>
          </div>
        </div>
      </div>
    )
  }

  const callerName = incomingCall?.callerName || outgoingCall?.targetName || 'Discussion'
  const streamsArray = Array.from(remoteStreams.entries())
  const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0 && !isVideoOff

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col animate-in slide-in-from-bottom duration-300 bg-[#111111]"
    >
      <div className="flex-1 relative p-2 overflow-hidden flex flex-col justify-center gap-2">
         {callStatus === 'CALLING' && streamsArray.length === 0 && (
           <div className="absolute inset-0 flex flex-col items-center justify-center">
             <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center animate-pulse mb-6">
                <Phone className="w-10 h-10 text-white/50" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
             <p className="text-white/60">Appel en cours...</p>
           </div>
         )}
         
         {streamsArray.length > 0 && (
           <div className={`w-full h-full grid gap-2 ${
             streamsArray.length === 1 && !hasLocalVideo ? 'grid-cols-1 grid-rows-1' :
             streamsArray.length <= 1 ? 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1' :
             streamsArray.length <= 3 ? 'grid-cols-2 grid-rows-2' :
             'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2'
           }`}>
             {streamsArray.map(([userId, stream]) => (
               <RemoteVideoPlayer key={userId} stream={stream} mediaType={remoteMediaType} userName={callerName} />
             ))}
             
             {hasLocalVideo && (
               <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden rounded-2xl shadow-xl border border-white/10">
                 <video
                   ref={localVideoRef}
                   autoPlay
                   playsInline
                   muted
                   className="w-full h-full object-cover scale-x-[-1]"
                 />
                 <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-bold border border-white/10">
                   Moi
                 </div>
               </div>
             )}
           </div>
         )}

        {/* Local Video Picture-in-Picture (If not in grid) */}
        {hasLocalVideo && streamsArray.length === 0 && (
           <div className="absolute inset-0 bg-gray-900">
             <video
               ref={localVideoRef}
               autoPlay
               playsInline
               muted
               className="w-full h-full object-cover scale-x-[-1]"
             />
           </div>
        )}
      </div>

      <div className="h-32 bg-gradient-to-t from-black to-transparent flex flex-col items-center justify-end pb-8 relative z-20">
        {callStatus === 'CONNECTED' && (
          <div className="text-white/90 text-sm font-medium mb-4 bg-black/40 px-4 py-1 rounded-full backdrop-blur-sm">
            {formatDuration(callDuration)}
          </div>
        )}
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              const muted = toggleMute()
              setIsMuted(!muted)
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
              isMuted ? 'bg-white text-black' : 'bg-white/15 text-white backdrop-blur-md'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={() => endCall(incomingCall?.conversationId || activeConversationId || '')}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xl hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #ff3a3a, #c0392b)' }}
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          <button
            onClick={() => {
              const videoOn = toggleVideo()
              setIsVideoOff(!videoOn)
            }}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
              isVideoOff ? 'bg-white text-black' : 'bg-white/15 text-white backdrop-blur-md'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  )
}
