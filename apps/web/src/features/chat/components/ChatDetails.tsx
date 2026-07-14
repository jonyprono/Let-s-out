import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Send, Play, MapPin, Calendar, Users, Share2, X, MoreVertical, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth.store'
import { useConversationMessages, useConversation, chatApi, useSendMessage, useConversationPresence } from '@/features/chat/api'
import { eventsApi } from '@/features/events/api'
import { useChatSocket } from '@/features/chat/hooks/useChatSocket'
import { SafeImage } from '@/components/shared/SafeImage'
import { ShareModal } from '@/components/shared/ShareModal'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { apiClient } from '@/lib/api-client'
import { ContributeModal } from '@/components/shared/ContributeModal'
import { toast } from 'sonner'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { resolveContributionAmount, computePoolStats, hasActivePool } from '@/lib/pool-contribution'
import { MessageBubble } from '@/components/ui/message-bubble'
import { ChatInput } from '@/components/ui/chat-input'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { GroupChatInfoSheet } from './GroupChatInfoSheet'
import { ForwardMessageModal } from './ForwardMessageModal'

async function saveFileLocally(file: File | Blob, name: string) {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    
    // remove data:image/png;base64, prefix
    const data = base64Data.split(',')[1]

    const savedFile = await Filesystem.writeFile({
      path: `lets_out_media/${name}`,
      data: data,
      directory: Directory.Documents,
      recursive: true
    })
    return savedFile.uri
  } catch (e) {
    console.error("Failed to save file locally", e)
    return null
  }
}
const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏']

// Group reactions by emoji → { emoji, count, users }
function groupReactions(reactions: any[]) {
  const map: Record<string, { emoji: string; count: number; users: string[] }> = {}
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, users: [] }
    map[r.emoji].count++
    map[r.emoji].users.push(r.user?.profile?.displayName ?? 'Utilisateur')
  }
  return Object.values(map)
}

function AudioMessage({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const updateProgress = () => {
      setProgress((audio.currentTime / (audio.duration || 1)) * 100)
    }
    const handleLoaded = () => setDuration(audio.duration)
    const handleEnd = () => { setIsPlaying(false); setProgress(0) }
    
    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', handleLoaded)
    audio.addEventListener('ended', handleEnd)
    return () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('loadedmetadata', handleLoaded)
      audio.removeEventListener('ended', handleEnd)
    }
  }, [])

  const togglePlay = () => {
    if (audioRef.current?.paused) {
      audioRef.current.play()
      setIsPlaying(true)
    } else {
      audioRef.current?.pause()
      setIsPlaying(false)
    }
  }

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const waveformHeights = [4, 7, 12, 5, 14, 16, 11, 6, 9, 15, 18, 11, 7, 13, 16, 10, 5, 9, 4, 7, 10, 6];

  return (
    <div className="flex flex-row items-center gap-[10px] w-full">
      <button onClick={togglePlay} className="flex items-center justify-center active:scale-95 transition-transform flex-shrink-0 text-[#8D8D8D]">
        {isPlaying ? <span className="w-3.5 h-3.5 bg-current rounded-sm" /> : <Play className="w-[20px] h-[20px] text-current fill-current" />}
      </button>
      
      <div className="flex-1 flex items-center gap-[2px] opacity-80 h-[24px]">
        {waveformHeights.map((h, i) => (
          <div key={i} className="w-[2.5px] bg-current rounded-full transition-all duration-100" style={{ height: `${h}px`, opacity: progress > (i / waveformHeights.length) * 100 ? 1 : 0.4 }} />
        ))}
      </div>
      
      <span className="text-[12px] font-medium text-[#1B1818]">
        {formatTime(duration || 16)}
      </span>
      <audio ref={audioRef} src={src} className="hidden" preload="metadata" />
    </div>
  )
}

function VideoMessage({ src }: { src: string, isMe: boolean }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  return (
    <>
      <div 
        className="relative bg-black cursor-pointer overflow-hidden group" 
        onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
      >
        <video 
          src={`${src}#t=0.001`} 
          className="w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" 
          style={{ maxHeight: '250px' }} 
          preload="metadata" 
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-[#1A1A1A]/90 backdrop-blur-sm flex items-center justify-center shadow-xl">
            <Play className="w-5 h-5 text-gray-900 dark:text-white ml-1 fill-gray-900" />
          </div>
        </div>
      </div>
      
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
           <div className="flex justify-between items-center p-4 pt-safe-4 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent">
             <span className="text-white/80 text-sm font-medium">Vidéo</span>
             <button onClick={() => setIsFullscreen(false)} className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A]/20 flex items-center justify-center text-white backdrop-blur-md active:scale-95 transition-transform">
               <X className="w-6 h-6" />
             </button>
           </div>
           <div className="flex-1 flex items-center justify-center pt-safe-top pb-safe-bottom">
             <video src={src} controls autoPlay playsInline className="w-full h-full object-contain max-h-[100dvh]" />
           </div>
        </div>
      )}
    </>
  )
}

const MessageStatusIcon = ({ status, color = "currentColor" }: { status: string, color?: string }) => {
  if (status === 'sending') return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
  if (status === 'sent') return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><polyline points="20 6 9 17 4 12"></polyline></svg>
  if (status === 'delivered') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><polyline points="18 6 7 17 2 12"></polyline><polyline points="22 10 16 16 14 14"></polyline></svg>
  if (status === 'read') return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 6 7 17 2 12"></polyline><polyline points="22 10 16 16 14 14"></polyline></svg>
  return null;
}

export function ChatDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { sendTyping, sendRead } = useChatSocket()

  const { data: messages = [], isLoading } = useConversationMessages(id!)
  const { data: conversation } = useConversation(id!)
  const { data: event } = useQuery({
    queryKey: ['events', conversation?.eventId],
    queryFn: () => conversation?.eventId ? eventsApi.getById(conversation.eventId).then((r) => r.data) : Promise.resolve(null),
    enabled: !!conversation?.eventId,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  })
  const { mutate: sendMsg } = useSendMessage(id!)
  const { data: presence } = useConversationPresence(id!)

  const isGroup = conversation?.isGroup ?? false
  const conversationTitle = event?.title ?? (conversation
    ? conversation.isGroup
      ? (conversation.name ?? 'Groupe')
      : (conversation.members.find((m) => m.userId !== user?.id)?.user?.profile?.displayName ?? 'Conversation')
    : 'Conversation')

  const conversationAvatar = event?.coverUrl ?? (conversation
    ? conversation.isGroup
      ? conversation.avatarUrl
      : (conversation.members.find((m) => m.userId !== user?.id)?.user?.profile?.avatarUrl ?? null)
    : null)

  const otherMember = conversation?.isGroup
    ? null
    : conversation?.members.find((m) => m.userId !== user?.id) ?? null

  const memberCount = conversation?.members?.length ?? 0

  const otherMembers = conversation?.members?.filter(m => m.userId !== user?.id) || []

  // Block status: 'i_blocked' = I blocked them, 'they_blocked' = they blocked me, 'none' = no block
  const blockStatus = conversation?.blockStatus ?? 'none'
  const isBlocked = blockStatus !== 'none'
  
  const getMessageStatus = (msg: any) => {
    if (msg._optimistic) return 'sending'
    const msgDate = new Date(msg.createdAt).getTime()
    
    // Check if anyone read it
    const isRead = otherMembers.some(m => m.lastReadAt && new Date(m.lastReadAt).getTime() >= msgDate)
    if (isRead) return 'read'
    
    // Check if anyone received it
    const isDelivered = otherMembers.some(m => m.lastDeliveredAt && new Date(m.lastDeliveredAt).getTime() >= msgDate)
    if (isDelivered) return 'delivered'
    
    return 'sent'
  }

  // UI state
  const [inputText, setInputText] = useState('')
  const [showEventInfo, setShowEventInfo] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showContributeModal, setShowContributeModal] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
  const [forwardMsg, setForwardMsg] = useState<{ content: string; type: string } | null>(null)
  const [localDeletedMessages, setLocalDeletedMessagesState] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`deleted-messages-${id}`)
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const setLocalDeletedMessages = (updater: string[] | ((prev: string[]) => string[])) => {
    setLocalDeletedMessagesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (typeof window !== 'undefined') {
        localStorage.setItem(`deleted-messages-${id}`, JSON.stringify(next))
      }
      return next
    })
  }
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const { openUserProfile } = useUserProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const qc = useQueryClient()

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCancelledRef = useRef(false)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read on open + send WS read event
  useEffect(() => {
    if (!id || !messages || messages.length === 0) return
    chatApi.markAsRead(id).then(() => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    }).catch(() => {})

    const lastMsg = messages?.[(messages?.length || 1) - 1]
    if (lastMsg) sendRead(id, lastMsg.id)
  }, [id, messages?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for typing events from WebSocket (via a custom event on the queryClient)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.conversationId !== id) return
      setTypingUser(e.detail.displayName ?? 'Quelqu\'un')
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000)
    }
    window.addEventListener('ws:typing' as any, handler)
    return () => window.removeEventListener('ws:typing' as any, handler)
  }, [id])

  // Send typing event (throttled)
  const handleTyping = (value: string) => {
    setInputText(value)
    if (id) sendTyping(id)
  }

  const handleSendText = () => {
    if (!inputText.trim() || !id) return
    const text = inputText
    setInputText('')
    sendMsg({ content: text, type: 'TEXT' })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !id) return
    
    const isVideo = file.type.startsWith('video/')
    const msgType = isVideo ? 'VIDEO' : 'IMAGE'
    const tempId = `optimistic-${Date.now()}`
    const localUrl = URL.createObjectURL(file)

    qc.setQueryData<any[]>(['chat', 'messages', id], (old = []) => [
      ...old,
      {
        id: tempId,
        content: localUrl,
        type: msgType,
        senderId: user?.id || '',
        conversationId: id,
        createdAt: new Date().toISOString(),
        isDeleted: false,
        reactions: [],
        sender: { id: user?.id, profile: user?.profile },
        _optimistic: true,
      }
    ])

    try {
      if (Capacitor.isNativePlatform()) {
        await saveFileLocally(file, file.name)
      }
      const url = await chatApi.uploadMedia(file)
      sendMsg({ content: url, type: msgType })
    } catch {
      toast.error("Erreur lors de l'envoi du fichier.")
    } finally {
      qc.setQueryData<any[]>(['chat', 'messages', id], (old = []) => old.filter(m => m.id !== tempId))
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Voice Notes
  const startRecording = async () => {
    try {
      isCancelledRef.current = false
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        if (isCancelledRef.current) return
        
        if (audioChunksRef.current.length > 0) {
          const mimeType = recorder.mimeType || 'audio/webm'
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
          const file = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: mimeType })
          
          const tempId = `optimistic-${Date.now()}`
          const localUrl = URL.createObjectURL(audioBlob)

          qc.setQueryData<any[]>(['chat', 'messages', id], (old = []) => [
            ...old,
            {
              id: tempId,
              content: localUrl,
              type: 'AUDIO',
              senderId: user?.id || '',
              conversationId: id,
              createdAt: new Date().toISOString(),
              isDeleted: false,
              reactions: [],
              sender: { id: user?.id, profile: user?.profile },
              _optimistic: true,
            }
          ])

          try {
            if (Capacitor.isNativePlatform()) {
              await saveFileLocally(audioBlob, file.name)
            }
            const url = await chatApi.uploadMedia(file)
            sendMsg({ content: url, type: 'AUDIO' })
          } catch (e) {
            toast.error("Erreur d'envoi de la note vocale")
          } finally {
            qc.setQueryData<any[]>(['chat', 'messages', id], (old = []) => old.filter(m => m.id !== tempId))
          }
        }
      }

      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        toast.error("Accès au microphone refusé. Ouverture des paramètres...")
        setTimeout(() => {
          import('capacitor-native-settings').then(({ NativeSettings, AndroidSettings, IOSSettings }) => {
            NativeSettings.open({
              optionAndroid: AndroidSettings.ApplicationDetails,
              optionIOS: IOSSettings.App
            }).catch(err => console.error(err))
          }).catch(err => console.error(err))
        }, 1500)
      } else {
        toast.error("Impossible d'accéder au microphone.")
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      isCancelledRef.current = true
      audioChunksRef.current = [] // clear chunks to prevent upload
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
    }
  }

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const openProfile = (userId: string, displayName?: string, avatarUrl?: string | null) => {
    if (userId === user?.id) return
    openUserProfile(userId, { displayName, avatarUrl })
  }

  // React to a message
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    setPickerMsgId(null)
    try {
      await apiClient.post(`/chat/messages/${messageId}/react`, { emoji })
      qc.invalidateQueries({ queryKey: ['chat', 'messages', id] })
    } catch { /* ignore */ }
  }, [id, qc])

  // Long press to open reaction picker
  const handlePressStart = (msgId: string) => {
    const timer = setTimeout(() => {
      setPickerMsgId(msgId)
    }, 500)
    setLongPressTimer(timer)
  }
  const handlePressEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer)
  }

  // Message actions
  const handleCopy = async (text: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Message copié')
    } catch {
      toast.error('Erreur lors de la copie')
    }
    setPickerMsgId(null)
  }

  const handleDeleteLocal = (msgId: string) => {
    setLocalDeletedMessages(prev => [...prev, msgId])
    setPickerMsgId(null)
  }

  const handleDeleteGlobal = async (msgId: string) => {
    // Hide the context menu immediately
    setPickerMsgId(null)
    
    // Optimistic UI update: mark message as deleted instantly
    qc.setQueryData<any[]>(['chat', 'messages', id], (old = []) => 
      old.map(m => m.id === msgId ? { ...m, isDeleted: true } : m)
    )
    
    try {
      chatApi.deleteMessage(msgId).catch(() => {
        // Revert on failure
        qc.invalidateQueries({ queryKey: ['chat', 'messages', id] })
        toast.error('Erreur lors de la suppression')
      })
    } catch (e) {
      // Ignored
    }
  }

  const openForwardModal = (msg: any) => {
    setForwardMsg({ content: msg.content, type: msg.type })
    setPickerMsgId(null)
  }

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col" style={{ fontFamily: "'Poppins', sans-serif" }} onClick={() => pickerMsgId && setPickerMsgId(null)}>
      
      {forwardMsg && (
        <ForwardMessageModal 
          onClose={() => setForwardMsg(null)}
          messageContent={forwardMsg.content}
          messageType={forwardMsg.type}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--color-background-primary)] border-b border-gray-100 dark:border-white/10 pt-safe-6 pb-2">
        <div className="flex items-center px-4">
          <button onClick={() => navigate('/messages')} className="p-2 -ml-2 hover:bg-gray-50 dark:bg-[#222222] rounded-full transition-colors active:scale-95">
            <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>

          <button
            className="flex items-center gap-3 ml-1 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
            onClick={() => {
              if (!isGroup && otherMember) {
                openProfile(otherMember.userId, otherMember.user?.profile?.displayName, otherMember.user?.profile?.avatarUrl)
              } else if (isGroup && event) {
                setShowEventInfo(true)
              }
            }}
          >
            <div className="relative flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-[#2a2a2a] overflow-hidden shadow-sm relative">
                <SafeImage
                  src={conversationAvatar}
                  alt={conversationTitle}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-gray-400">
                      {conversationTitle.charAt(0).toUpperCase()}
                    </div>
                  }
                />
              </div>
              {presence?.isOtherOnline && (
                <div className="absolute bottom-0 right-0 w-[14px] h-[14px] bg-[#4ADE80] border-[2px] border-white dark:border-[#2A2A2A] rounded-full z-10" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-gray-900 dark:text-white text-[16px] truncate leading-tight tracking-tight">{conversationTitle}</h2>
              {typingUser ? (
                <p className="text-[13px] text-action-primary font-medium animate-pulse mt-0.5">{typingUser} écrit...</p>
              ) : isGroup ? (
                <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  {memberCount} participant{memberCount !== 1 ? 's' : ''}
                  {presence?.onlineCount ? `, ${presence.onlineCount} en ligne` : ''}
                </p>
              ) : presence?.isOtherOnline ? (
                <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 mt-0.5">En ligne</p>
              ) : (
                <p className="text-[13px] font-medium text-gray-400 mt-0.5">Hors ligne</p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                if (!isGroup && otherMember) {
                  openProfile(otherMember.userId, otherMember.user?.profile?.displayName, otherMember.user?.profile?.avatarUrl)
                } else if (isGroup && event) {
                  setShowEventInfo(true)
                }
              }}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 dark:bg-[#222222] rounded-full transition-colors active:scale-95"
            >
              <MoreVertical className="w-[20px] h-[20px] text-gray-400" />
            </button>
          </div>
        </div>

        {event && hasActivePool(event) && (
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex-1 mr-4">
              <p className="text-[13px] font-bold text-gray-900 dark:text-[#FFFFFF] mb-1.5">Cagnotte en cours</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-gray-200 dark:bg-[#444] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-action-primary"
                    style={{ width: `${computePoolStats(event).progress}%` }}
                  />
                </div>
                <span className="text-[12px] font-bold text-action-primary">{computePoolStats(event).progress}%</span>
              </div>
            </div>
            {event.startAt && new Date(event.startAt).getTime() > Date.now() && (
              <button
                onClick={() => {
                  if (event) navigate(`/events/${event.id}/pay?type=contribution`)
                }}
                className="rounded-full border-[1.5px] border-action-primary text-action-primary px-4 py-1.5 text-[12px] font-bold active:scale-95 transition-transform touch-sm"
              >
                Contribuer
              </button>
            )}
          </div>
        )}

        {(event as any)?.validatorVoteStatus === 'OPEN' && (
          <div className="px-4 pb-2 relative z-20">
            <div className="bg-[#FFF2D3] dark:bg-[#332200] border border-[#FFD073] dark:border-[#CC6600] rounded-lg p-3 flex items-center justify-between shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                 onClick={() => event && navigate(`/events/${event.id}/validators-vote`)}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF7A00]/20 flex items-center justify-center shrink-0">
                  <span className="text-lg">📊</span>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#CC6600] dark:text-[#FFB366]">Vote des validateurs en cours</p>
                  <p className="text-[11px] text-[#CC6600]/80 dark:text-[#FFB366]/80">Votre avis est requis pour débloquer les fonds</p>
                </div>
              </div>
              <button className="text-[12px] font-bold text-white bg-[#FF7A00] hover:bg-[#E66E00] px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform">
                Voter
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 bg-[var(--color-background-primary)]" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        {isLoading ? (
          <div className="flex flex-col gap-4 py-4">
            {[1, 2, 3, 4, 5].map(i => {
              const isMe = i % 2 === 0
              return (
              <div key={i} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && isGroup && <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#202C33] animate-pulse flex-shrink-0 self-end" />}
                <div className={`h-[42px] rounded-2xl bg-gray-200/80 dark:bg-[#202C33] animate-pulse ${isMe ? 'w-[180px] rounded-br-sm' : 'w-[220px] rounded-bl-sm'}`} />
              </div>
            )})}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-50/20 flex items-center justify-center text-2xl">💬</div>
            <p className="text-sm text-gray-400 dark:text-gray-400">Aucun message pour le moment</p>
            <p className="text-xs text-gray-300 dark:text-gray-400">Soyez le premier à écrire !</p>
          </div>
        ) : (
          messages.filter(msg => !localDeletedMessages.includes(msg.id)).map((msg, index) => {
            const isSystem = msg.type === 'SYSTEM'
            const isMe = !isSystem && msg.senderId === user?.id
            const senderName = msg.sender?.profile?.displayName ?? 'Inconnu'
            const senderAvatar = msg.sender?.profile?.avatarUrl ?? null
            const showSenderInfo = isGroup && !isMe

            const prevMsg = index > 0 ? messages[index - 1] : null
            const showDateSep = !prevMsg ||
              new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString()

            // Group consecutive messages from same sender
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId || showDateSep

            const isImage = msg.type === 'IMAGE'
            const isVideo = msg.type === 'VIDEO'
            const isAudio = msg.type === 'AUDIO'
            const isMedia = isImage || isVideo || isAudio

            const grouped = groupReactions(msg.reactions ?? [])

            if (isSystem) {
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-[#333333]" />
                      <span className="text-xs text-gray-400 dark:text-gray-400 font-medium capitalize px-2">
                        {format(new Date(msg.createdAt), 'EEEE d MMMM', { locale: fr })}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-[#333333]" />
                    </div>
                  )}
                  <div className="flex justify-center my-2 px-4">
                    <p className="text-[13px] text-center text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2a2a2a]/90 px-4 py-2 rounded-full max-w-[90%] leading-snug">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex justify-center my-4">
                    <span className="text-[12px] bg-[#F2F2F2] dark:bg-[#2A2A2A] text-[#8D8D8D] dark:text-[#A3A3A3] font-medium px-3 py-1 rounded-full">
                      {format(new Date(msg.createdAt), 'EEEE d MMMM', { locale: fr })}
                    </span>
                  </div>
                )}

                <div
                  className={`relative ${pickerMsgId === msg.id ? 'z-50' : ''}`}
                  onMouseDown={() => handlePressStart(msg.id)}
                  onMouseUp={handlePressEnd}
                  onTouchStart={() => handlePressStart(msg.id)}
                  onTouchEnd={handlePressEnd}
                >
                  {showSenderInfo && isFirstInGroup && (
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 pl-10 pr-10`}>
                      <button
                        className="text-[11px] font-semibold text-action-primary active:opacity-70"
                        onClick={() => openProfile(msg.senderId, senderName, senderAvatar)}
                      >
                        {senderName}
                      </button>
                    </div>
                  )}

                  {/* Context menu (moved to bottom sheet) */}

                  <MessageBubble
                    isSender={isMe}
                    time={format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                    status={getMessageStatus(msg)}
                    showAvatar={showSenderInfo && isFirstInGroup}
                    senderName={senderName}
                    avatarUrl={senderAvatar || undefined}
                    showSpacer={showSenderInfo && !isFirstInGroup}
                    onAvatarClick={() => openProfile(msg.senderId, senderName, senderAvatar)}
                    imageUrl={isImage && msg.content ? msg.content : undefined}
                    onImageClick={() => setFullscreenImage(msg.content ?? null)}
                    content={!isMedia && !msg.isDeleted && msg.type !== 'POLL' ? (msg.content ?? undefined) : undefined}
                  >
                    {msg.isDeleted ? (
                      <div className="flex items-center gap-2 italic text-[#FF7A00]">
                        <Trash2 className="w-4 h-4 opacity-70" />
                        <span className="text-[14px]">Ce message a été supprimé</span>
                        <span className="text-[10px] text-[var(--color-text-secondary)] opacity-70 align-bottom leading-none ml-2">
                          {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                        </span>
                      </div>
                    ) : msg.type === 'POLL' ? (
                      <div className="w-[240px] flex flex-col gap-3 p-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, currentColor 15%, transparent)' }}>
                            <span className="text-lg">📊</span>
                          </div>
                          <div>
                            <p className="text-[13px] font-bold" style={{ color: 'currentColor' }}>Vote des validateurs</p>
                            <p className="text-[11px]" style={{ color: 'color-mix(in srgb, currentColor 80%, transparent)' }}>Votre avis est requis pour débloquer les fonds</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => navigate(`/events/${conversation?.eventId}/validators-vote`)}
                          className="w-full py-2 rounded-lg font-bold text-sm transition-transform active:scale-95"
                          style={{ backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)', color: 'currentColor' }}
                        >
                          {(event as any)?.validatorVoteStatus === 'CLOSED' ? 'Voir les résultats' : 'Voter'}
                        </button>
                      </div>
                    ) : isVideo && msg.content ? (
                      <div className="relative">
                        <VideoMessage src={msg.content} isMe={isMe} />
                        <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full">
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[9px] font-medium text-white">
                              {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                            </span>
                            {isMe && <MessageStatusIcon status={getMessageStatus(msg)} color="white" />}
                          </div>
                        </div>
                      </div>
                    ) : isAudio && msg.content ? (
                      <div className="w-[200px] flex flex-col py-1">
                        <AudioMessage src={msg.content} />
                        <div className="flex items-center justify-end gap-1 mt-1 -mb-1 pr-2">
                          <span className="text-[10px] font-medium opacity-70" style={{ color: isMe ? '#1B1818' : 'var(--color-text-secondary)' }}>
                            {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                          </span>
                          {isMe && <MessageStatusIcon status={getMessageStatus(msg)} color={isMe ? '#1B1818' : 'var(--color-text-secondary)'} />}
                        </div>
                      </div>
                    ) : null}
                  </MessageBubble>

                    {/* Reactions display */}
                    {grouped.length > 0 && (
                      <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {grouped.map(({ emoji, count }) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="flex items-center gap-0.5 bg-white dark:bg-[#2A2A2A] border border-gray-200 dark:border-[#333333] rounded-full px-2 py-0.5 text-[12px] shadow-sm active:scale-95 transition-transform"
                          >
                            <span>{emoji}</span>
                            {count > 1 && <span className="text-gray-600 dark:text-gray-300 font-medium text-[11px]">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
            )
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area — fixed at the bottom (nav is hidden for /chat/ routes) */}
      <div className="fixed left-0 right-0 z-20 bg-[var(--color-background-primary)] border-t border-[#F2F2F2] px-4 py-3 flex items-center gap-3" style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
        {isBlocked ? (
          <div className="flex-1 flex items-center justify-center h-[48px] bg-[#F9F9F9] dark:bg-[#2A2A2A] border border-[#DFDFDF] dark:border-[#333] rounded-full px-[16px] gap-[8px]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            <span className="text-[13px] text-gray-400 dark:text-gray-500">
              {blockStatus === 'i_blocked' ? 'Vous avez bloqué cet utilisateur' : 'Vous ne pouvez pas répondre à cette conversation'}
            </span>
          </div>
        ) : isRecording ? (
          <div className="flex-1 flex items-center justify-between h-[48px] bg-[#FCFCFC] border border-[#DFDFDF] rounded-full px-[16px] gap-[12px] overflow-hidden relative">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-500 font-medium text-[15px]">{formatRecordingTime(recordingTime)}</span>
            </div>
            <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <ChatInput
            value={inputText}
            onChange={handleTyping}
            onSend={handleSendText}
            onAttach={() => fileInputRef.current?.click()}
            onCamera={() => fileInputRef.current?.click()}
            onMic={startRecording}
            className="p-0 flex-1"
          />
        )}

        {!isBlocked && isRecording && (
          <button
            onClick={stopRecording}
            className="w-[48px] h-[48px] rounded-full flex items-center justify-center bg-[#FF7A00] text-white shadow-sm flex-shrink-0 animate-in zoom-in duration-200"
          >
            <Send className="w-[22px] h-[22px] ml-1" />
          </button>
        )}
      </div>

      {showContributeModal && event && hasActivePool(event) && (
        <ContributeModal
          event={event}
          onClose={() => setShowContributeModal(false)}
          onConfirm={(amount) => {
            const resolved = resolveContributionAmount(event, amount)
            if ('error' in resolved) {
              toast.error(resolved.error)
              return
            }
            setShowContributeModal(false)
            navigate(`/events/${event.id}/pay?amount=${resolved.amount}&type=contribution`)
          }}
        />
      )}

      {/* Event Info / Group Chat Info Modal */}
      {showEventInfo && event && conversation && (
        conversation.isGroup ? (
          <GroupChatInfoSheet 
            conversation={conversation} 
            event={event} 
            onClose={() => setShowEventInfo(false)}
            onInvite={() => {
              setShowEventInfo(false)
              setShowShareModal(true)
            }}
            onContribute={() => {
              setShowEventInfo(false)
              navigate(`/events/${event.id}/pay?type=contribution`)
            }}
          />
        ) : (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center">
            <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-[32px] p-6 pb-10 shadow-2xl relative animate-in slide-in-from-bottom-full duration-300">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-[#333333] rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[17px] font-bold text-gray-900 dark:text-[#FFFFFF]">À propos</h2>
                <button onClick={() => setShowEventInfo(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center">
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              <div className="mb-6">
                <h3 className="font-bold text-[17px] text-gray-900 dark:text-[#FFFFFF] mb-4">{event.title}</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-[14px] text-gray-600 dark:text-gray-300">
                      {format(new Date(event.startAt), 'EEE, dd MMM yyyy • HH:mm', { locale: fr })} GMT
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="text-[14px] text-gray-600 dark:text-gray-300">{event.address || event.city || 'Lieu non précisé'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="text-[14px] text-gray-600 dark:text-gray-300">
                      {event.currentAttendees ?? 0} participant{(event.currentAttendees ?? 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2A2A2A] text-gray-800 dark:text-gray-200 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
                >
                  <Calendar className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  Voir l'événement
                </button>
                <button
                  onClick={() => {
                    setShowEventInfo(false)
                    setShowShareModal(true)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2A2A2A] text-gray-800 dark:text-gray-200 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
                >
                  <Share2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  Inviter des amis
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {showShareModal && event && (
        <ShareModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="flex justify-between items-center p-4 pt-safe-4 absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent">
            <span className="text-white/80 text-sm font-medium">Image</span>
            <button onClick={() => setFullscreenImage(null)} className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A]/20 flex items-center justify-center text-white backdrop-blur-md active:scale-95 transition-transform">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center pt-safe-top pb-safe-bottom">
            <img src={fullscreenImage} alt="Fullscreen content" className="w-full h-full object-contain max-h-[100dvh]" />
          </div>
        </div>
      )}

      {/* Message Context Menu Bottom Sheet */}
      <BottomSheet open={!!pickerMsgId} onClose={() => setPickerMsgId(null)}>
        {pickerMsgId && (() => {
          const msg = messages?.find(m => m.id === pickerMsgId)
          if (!msg) return null
          const isMe = msg.senderId === user?.id
          return (
            <div className="flex flex-col pb-4">
              {/* Reactions */}
              <div className="flex justify-around items-center px-4 py-5 border-b border-gray-100 dark:border-white/10">
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(msg.id, emoji)}
                    className="text-[32px] active:scale-110 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              
              {/* Actions */}
              <div className="flex flex-col py-2 px-2">
                {!msg.isDeleted && msg.content && msg.type !== 'POLL' && (
                  <button
                    onClick={() => handleCopy(msg.content!)}
                    className="flex items-center gap-4 px-4 py-4 text-[16px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 dark:active:bg-white/10 rounded-2xl transition-colors text-left"
                  >
                    <span className="w-[22px] h-[22px]" style={{ display: 'inline-block', background: 'currentColor', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Crect x=%229%22 y=%229%22 width=%2213%22 height=%2213%22 rx=%222%22 ry=%222%22%3E%3C/rect%3E%3Cpath d=%22M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1%22%3E%3C/path%3E%3C/svg%3E")', maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />
                    Copier
                  </button>
                )}
                {!msg.isDeleted && msg.type !== 'POLL' && (
                  <button
                    onClick={() => openForwardModal(msg)}
                    className="flex items-center gap-4 px-4 py-4 text-[16px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 active:bg-gray-100 dark:active:bg-white/10 rounded-2xl transition-colors text-left"
                  >
                    <span className="w-[22px] h-[22px]" style={{ display: 'inline-block', background: 'currentColor', maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%2215 14 20 9 15 4%22%3E%3C/polyline%3E%3Cpath d=%22M4 20v-7a4 4 0 0 1 4-4h12%22%3E%3C/path%3E%3C/svg%3E")', maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }} />
                    Transférer
                  </button>
                )}
                <button
                  onClick={() => handleDeleteLocal(msg.id)}
                  className="flex items-center gap-4 px-4 py-4 text-[16px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 dark:active:bg-red-500/20 rounded-2xl transition-colors text-left"
                >
                  <Trash2 className="w-[22px] h-[22px]" />
                  Supprimer pour moi
                </button>
                {isMe && !msg.isDeleted && (
                  <button
                    onClick={() => handleDeleteGlobal(msg.id)}
                    className="flex items-center gap-4 px-4 py-4 text-[16px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 dark:active:bg-red-500/20 rounded-2xl transition-colors text-left"
                  >
                    <Trash2 className="w-[22px] h-[22px]" />
                    Supprimer pour tous
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </BottomSheet>
    </div>
  )
}
