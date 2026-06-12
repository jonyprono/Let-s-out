import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Send, Paperclip, Play, Info, MapPin, Calendar, Users, Share2, X, Check, Phone, Video, Mic, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuthStore } from '@/stores/auth.store'
import { useConversationMessages, useConversation, chatApi, useSendMessage } from '@/features/chat/api'
import { eventsApi } from '@/features/events/api'
import { useChatSocket } from '@/features/chat/hooks/useChatSocket'
import { SafeImage } from '@/components/shared/SafeImage'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { apiClient } from '@/lib/api-client'
import { shareLink } from '@/lib/utils'
import { ContributeModal } from '@/components/shared/ContributeModal'
import { toast } from 'sonner'
import { resolveContributionAmount, computePoolStats, hasActivePool } from '@/lib/pool-contribution'

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

  // UI state
  const [inputText, setInputText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showEventInfo, setShowEventInfo] = useState(false)
  const [showContributeModal, setShowContributeModal] = useState(false)
  const [pickerMsgId, setPickerMsgId] = useState<string | null>(null)
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read on open + send WS read event
  useEffect(() => {
    if (!id || messages.length === 0) return
    chatApi.markAsRead(id).then(() => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    }).catch(() => {})

    const lastMsg = messages[messages.length - 1]
    if (lastMsg) sendRead(id, lastMsg.id)
  }, [id, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setIsUploading(true)
    try {
      const url = await chatApi.uploadMedia(file)
      sendMsg({ content: url, type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE' })
    } catch {
      alert("Erreur lors de l'envoi du fichier.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Voice Notes
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        if (audioChunksRef.current.length > 0) {
          const mimeType = recorder.mimeType || 'audio/webm'
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
          const file = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: mimeType })
          
          setIsUploading(true)
          try {
            const url = await chatApi.uploadMedia(file)
            sendMsg({ content: url, type: 'AUDIO' })
          } catch (e) {
            toast.error("Erreur d'envoi de la note vocale")
          } finally {
            setIsUploading(false)
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

  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col" onClick={() => pickerMsgId && setPickerMsgId(null)}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-50 pt-safe-only shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="h-[68px] flex items-center px-4">
          <button onClick={() => navigate('/messages')} className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors active:scale-95">
            <ChevronLeft className="w-6 h-6 text-gray-900" />
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
              <div className="w-11 h-11 rounded-full bg-gray-100 overflow-hidden shadow-sm">
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
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-gray-900 text-[16px] truncate leading-tight tracking-tight">{conversationTitle}</h2>
              {typingUser ? (
                <p className="text-[13px] text-action-primary font-medium animate-pulse mt-0.5">{typingUser} écrit...</p>
              ) : isGroup ? (
                <p className="text-[13px] font-medium text-gray-500 mt-0.5">{memberCount} participant{memberCount !== 1 ? 's' : ''}</p>
              ) : (
                <p className="text-[13px] font-medium text-gray-500 mt-0.5">Voir le profil</p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                if (isGroup) {
                  toast.error('Les appels de groupe ne sont pas encore supportés.')
                  return
                }
                window.dispatchEvent(new CustomEvent('call:start_outgoing', {
                  detail: { conversationId: id, targetUserId: otherMember?.userId, mediaType: 'audio' }
                }))
              }}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors active:scale-95"
            >
              <Phone className="w-[20px] h-[20px] text-gray-500" />
            </button>
            <button
              onClick={() => {
                if (isGroup) {
                  toast.error('Les appels de groupe ne sont pas encore supportés.')
                  return
                }
                window.dispatchEvent(new CustomEvent('call:start_outgoing', {
                  detail: { conversationId: id, targetUserId: otherMember?.userId, mediaType: 'video' }
                }))
              }}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors active:scale-95"
            >
              <Video className="w-[22px] h-[22px] text-gray-500" />
            </button>
            {event && (
              <button onClick={() => setShowEventInfo(true)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors active:scale-95">
                <Info className="w-[22px] h-[22px] text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {event && hasActivePool(event) && (
          <div className="flex items-center justify-between px-4 pb-4">
            <div className="flex-1 mr-4">
              <p className="text-[13px] font-bold text-gray-900 dark:text-[#FFFFFF] mb-1.5">Cagnotte en cours</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-[#333333] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-action-primary"
                    style={{ width: `${computePoolStats(event).progress}%` }}
                  />
                </div>
                <span className="text-[12px] font-bold text-action-primary">{computePoolStats(event).progress}%</span>
              </div>
            </div>
            <button
              onClick={() => setShowContributeModal(true)}
              className="rounded-full border-[1.5px] border-action-primary text-action-primary px-4 py-1.5 text-[12px] font-bold active:scale-95 transition-transform touch-sm"
            >
              Contribuer
            </button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F8F9FA]">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-[#333333] animate-pulse flex-shrink-0" />
                <div className={`h-10 rounded-2xl bg-gray-200 dark:bg-[#333333] animate-pulse ${i % 2 === 0 ? 'w-32' : 'w-48'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-50/20 flex items-center justify-center text-2xl">💬</div>
            <p className="text-sm text-gray-400 dark:text-gray-500">Aucun message pour le moment</p>
            <p className="text-xs text-gray-300 dark:text-gray-600">Soyez le premier à écrire !</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSystem = msg.type === 'SYSTEM'
            const isMe = !isSystem && msg.senderId === user?.id
            const senderName = msg.sender?.profile?.displayName ?? 'Inconnu'
            const senderAvatar = msg.sender?.profile?.avatarUrl ?? null
            const showSenderInfo = isGroup && !isMe

            const prevMsg = index > 0 ? messages[index - 1] : null
            const showDateSep = !prevMsg ||
              new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString()

            // Group consecutive messages from same sender
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId

            const isImage = msg.type === 'IMAGE'
            const isVideo = msg.type === 'VIDEO'
            const isAudio = msg.type === 'AUDIO'
            const isMedia = isImage || isVideo || isAudio
            const isLastMsg = index === messages.length - 1

            const grouped = groupReactions(msg.reactions ?? [])

            if (isSystem) {
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-[#333333]" />
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium capitalize px-2">
                        {format(new Date(msg.createdAt), 'EEEE d MMMM', { locale: fr })}
                      </span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-[#333333]" />
                    </div>
                  )}
                  <div className="flex justify-center my-2 px-4">
                    <p className="text-[13px] text-center text-gray-500 dark:text-gray-400 bg-gray-100/90 dark:bg-[#2A2A2A] px-4 py-2 rounded-full max-w-[90%] leading-snug">
                      {msg.content}
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-[#333333]" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium capitalize px-2">
                      {format(new Date(msg.createdAt), 'EEEE d MMMM', { locale: fr })}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-[#333333]" />
                  </div>
                )}

                <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}>
                  {/* Avatar */}
                  {showSenderInfo ? (
                    isFirstInGroup ? (
                      <button
                        className="w-7 h-7 rounded-full bg-gray-200 dark:bg-[#333333] overflow-hidden flex-shrink-0 mb-1 active:opacity-70"
                        onClick={() => openProfile(msg.senderId, senderName, senderAvatar)}
                      >
                        <SafeImage
                          src={senderAvatar}
                          alt={senderName}
                          className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">{senderName.charAt(0).toUpperCase()}</div>}
                        />
                      </button>
                    ) : <div className="w-7 flex-shrink-0" />
                  ) : isGroup && isMe ? <div className="w-7 flex-shrink-0" /> : null}

                  {/* Bubble */}
                  <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'} relative`}
                    onMouseDown={() => handlePressStart(msg.id)}
                    onMouseUp={handlePressEnd}
                    onTouchStart={() => handlePressStart(msg.id)}
                    onTouchEnd={handlePressEnd}
                  >
                    {showSenderInfo && isFirstInGroup && (
                      <button
                        className="text-[11px] font-semibold text-action-primary mb-0.5 ml-1 active:opacity-70"
                        onClick={() => openProfile(msg.senderId, senderName, senderAvatar)}
                      >
                        {senderName}
                      </button>
                    )}

                    {/* Reaction emoji picker (shown on long press) */}
                    {pickerMsgId === msg.id && (
                      <div
                        className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-14 z-50 bg-white dark:bg-[#2A2A2A] rounded-full shadow-2xl border border-gray-100 dark:border-[#444444] flex gap-1 px-3 py-2`}
                        onClick={e => e.stopPropagation()}
                      >
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="text-xl active:scale-125 transition-transform hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.isDeleted ? (
                      <div className="rounded-[20px] px-4 py-2.5 bg-gray-100 border border-gray-200 italic">
                        <p className="text-[14px] text-gray-400">Message supprimé</p>
                      </div>
                    ) : isMedia ? (
                      <div
                        className={`rounded-[20px] overflow-hidden shadow-sm ${isMe ? 'rounded-br-sm' : 'rounded-tl-sm'} ${isAudio ? (isMe ? 'bg-action-primary text-white' : 'bg-white border border-gray-100') : ''}`}
                        style={{ maxWidth: '260px' }}
                      >
                        {isImage && msg.content ? (
                          <SafeImage
                            src={msg.content}
                            alt="photo"
                            className="w-full object-cover"
                            style={{ maxHeight: '300px' } as React.CSSProperties}
                          />
                        ) : isVideo && msg.content ? (
                          <div className="relative bg-black">
                            <video src={msg.content} className="w-full object-cover" style={{ maxHeight: '300px' }} />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                <Play className="w-5 h-5 text-gray-800 ml-1" />
                              </div>
                            </div>
                          </div>
                        ) : isAudio && msg.content ? (
                          <div className="px-3 py-2 flex flex-col">
                            <audio controls controlsList="nodownload noplaybackrate" src={msg.content} className={`h-10 w-[200px] ${isMe ? 'invert sepia contrast-200' : ''}`} />
                          </div>
                        ) : null}
                        <div className={`px-3 py-1.5 ${isMe ? 'bg-action-primary' : 'bg-white'}`}>
                          <span className={`text-[11px] block text-right font-medium ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
                            {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-[20px] px-4 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
                          isMe
                            ? `bg-action-primary text-white rounded-br-sm`
                            : `bg-white border border-gray-50 text-gray-900 rounded-tl-sm`
                        }`}
                        style={{ maxWidth: '280px' }}
                      >
                        <p className="text-[15px] leading-relaxed break-words">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[11px] font-medium ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
                            {format(new Date(msg.createdAt), 'HH:mm', { locale: fr })}
                          </span>
                          {isMe && isLastMsg && (
                            <Check className="w-3 h-3 text-white/80" />
                          )}
                        </div>
                      </div>
                    )}

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
                            {count > 1 && <span className="text-gray-600 font-medium text-[11px]">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}

        {isUploading && (
          <div className="flex justify-end">
            <div className="bg-gray-200 text-gray-500 rounded-2xl px-4 py-2 text-sm italic animate-pulse">
              Envoi en cours...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-end gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 mb-1 text-gray-400 hover:bg-gray-50 rounded-full transition-colors flex-shrink-0"
          disabled={isUploading}
        >
          <Paperclip className="w-[22px] h-[22px]" />
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
        
        <div className="flex-1 bg-[#F3F4F6] rounded-[24px] flex items-center px-2 py-1.5 min-h-[48px] overflow-hidden transition-all relative">
          {isRecording ? (
            <div className="flex items-center justify-between w-full px-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-500 font-medium text-[15px]">{formatRecordingTime(recordingTime)}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <input
              type="text"
              value={inputText}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendText() }}
              placeholder="Écrire un message..."
              className="flex-1 bg-transparent border-none px-3 text-[15px] text-gray-900 placeholder:text-gray-500 outline-none min-w-0"
            />
          )}

          {isRecording ? (
            <button
              onClick={stopRecording}
              className="w-[36px] h-[36px] rounded-full flex items-center justify-center bg-action-primary text-white shadow-sm flex-shrink-0 animate-in zoom-in duration-200"
            >
              <Send className="w-[18px] h-[18px] ml-0.5" />
            </button>
          ) : inputText.trim() ? (
            <button
              onClick={handleSendText}
              disabled={isUploading}
              className="w-[36px] h-[36px] rounded-full flex items-center justify-center bg-action-primary text-white shadow-sm flex-shrink-0 animate-in zoom-in duration-200"
            >
              <Send className="w-[18px] h-[18px] ml-0.5" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={isUploading}
              className="w-[36px] h-[36px] rounded-full flex items-center justify-center bg-gray-300 hover:bg-gray-400 text-white flex-shrink-0 transition-colors"
            >
              <Mic className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
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

      {/* Event Info Modal */}
      {showEventInfo && event && (
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
                onClick={async () => {
                  await shareLink(
                    event.title,
                    "Rejoins cet événement sur Let's Out !",
                    window.location.origin + `/events/${event.id}`
                  )
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2A2A2A] text-gray-800 dark:text-gray-200 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
              >
                <Share2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                Inviter des amis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
