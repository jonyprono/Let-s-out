import { useState, useMemo } from 'react'
import { X, Search, Check, Send, Calendar, MapPin, Users } from 'lucide-react'
import { useFriends } from '@/features/users/api'
import { useMutation } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
import { SafeImage } from '@/components/shared/SafeImage'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface InviteFriendsModalProps {
  event: {
    id: string
    title: string
    coverUrl?: string | null
    startAt: string
    city?: string | null
    currentAttendees?: number
  }
  onClose: () => void
}

export function InviteFriendsModal({ event, onClose }: InviteFriendsModalProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const { data: friends = [], isLoading } = useFriends()

  const { mutate: sendInvites, isPending } = useMutation({
    mutationFn: () => eventsApi.inviteFriends(event.id, selected),
    onSuccess: () => {
      toast.success(`${selected.length} invitation${selected.length > 1 ? 's' : ''} envoyée${selected.length > 1 ? 's' : ''} !`)
      onClose()
    },
    onError: () => toast.error("Erreur lors de l'envoi des invitations"),
  })

  const filtered = useMemo(() =>
    friends.filter((f: any) =>
      f.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      f.username?.toLowerCase().includes(search.toLowerCase())
    ),
    [friends, search]
  )

  const toggle = (userId: string) => {
    setSelected(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-white dark:bg-[#121212]">
      {/* Header */}
      <div className="px-4 pt-safe-4 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-white/8">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Inviter des amis</h2>
        <div className="w-9" />
      </div>

      {/* Event Card Preview */}
      <div className="mx-4 mt-4 mb-2 rounded-2xl overflow-hidden border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-[#1E1E1E] flex items-center gap-3 p-3">
        {event.coverUrl ? (
          <img src={event.coverUrl} alt={event.title} className="w-14 h-14 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{event.title}</p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
            {format(new Date(event.startAt), "EEE d MMM · HH'h'mm", { locale: fr })}
          </p>
          {event.city && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />{event.city}
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un ami..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-[#2A2A2A] rounded-xl text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="px-4 mb-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {selected.map(uid => {
            const f = friends.find((fr: any) => fr.userId === uid)
            if (!f) return null
            return (
              <button
                key={uid}
                onClick={() => toggle(uid)}
                className="flex items-center gap-1.5 bg-[#FF7A00]/10 text-[#FF7A00] rounded-full px-3 py-1 text-[12px] font-semibold shrink-0 active:scale-95 transition-transform"
              >
                <SafeImage src={f.avatarUrl} alt={f.displayName} className="w-4 h-4 rounded-full" />
                {f.displayName?.split(' ')[0]}
                <X className="w-3 h-3" />
              </button>
            )
          })}
        </div>
      )}

      {/* Friend list */}
      <div className="flex-1 overflow-y-auto px-4" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="flex flex-col gap-3 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-[#2A2A2A] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2A2A2A] rounded" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-[#2A2A2A] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center">
              <Users className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center">
              {search ? 'Aucun ami trouvé' : 'Vous n\'avez pas encore d\'amis à inviter'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/6">
            {filtered.map((f: any) => {
              const isSelected = selected.includes(f.userId)
              return (
                <button
                  key={f.userId}
                  onClick={() => toggle(f.userId)}
                  className="w-full flex items-center gap-3 py-3 active:bg-gray-50 dark:active:bg-white/5 transition-colors text-left"
                >
                  <div className="relative shrink-0">
                    <SafeImage
                      src={f.avatarUrl}
                      alt={f.displayName}
                      className="w-12 h-12 rounded-full bg-gray-200 dark:bg-[#2A2A2A] object-cover"
                    />
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#FF7A00] rounded-full flex items-center justify-center border-2 border-white dark:border-[#121212]">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">{f.displayName}</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate">@{f.username}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 transition-all ${isSelected ? 'border-[#FF7A00] bg-[#FF7A00]' : 'border-gray-300 dark:border-gray-600'} flex items-center justify-center`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="px-4 pt-3 pb-safe-6">
        <button
          onClick={() => sendInvites()}
          disabled={selected.length === 0 || isPending}
          className="w-full py-4 rounded-2xl bg-[#FF7A00] text-white font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              Envoyer {selected.length > 0 ? `(${selected.length})` : ''} invitation{selected.length > 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
