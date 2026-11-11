import { useState } from 'react'
import { formatDistanceToNow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SafeImage } from '@/components/shared/SafeImage'
import { useAuthStore } from '@/stores/auth.store'
import { chatApi, Poll, Message } from '../api'

interface PollCardProps {
  message: Message
  onPollUpdated?: (poll: Poll) => void
}

export function PollCard({ message, onPollUpdated }: PollCardProps) {
  const currentUserId = useAuthStore((s: any) => s.user?.id)
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null)

  const poll = message.poll
  if (!poll) return null

  const isExpired = poll.isClosed || (poll.expiresAt ? isPast(new Date(poll.expiresAt)) : false)

  // Calcul du total des votes
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0)

  // Date relative d'expiration
  let remainingTimeStr = ''
  if (isExpired) {
    remainingTimeStr = 'Sondage terminé'
  } else if (poll.expiresAt) {
    remainingTimeStr = formatDistanceToNow(new Date(poll.expiresAt), {
      addSuffix: false,
      locale: fr,
    }) + ' restant' + (poll.expiresAt ? 's' : '')
  }

  const handleVote = async (optionId: string) => {
    if (isExpired) {
      toast.info('Ce sondage est déjà clôturé.')
      return
    }

    setVotingOptionId(optionId)
    try {
      const updated = await chatApi.votePoll(poll.id, optionId)
      onPollUpdated?.(updated)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Erreur lors du vote'
      toast.error(msg)
    } finally {
      setVotingOptionId(null)
    }
  }

  const senderProfile = message.sender?.profile
  const isCreator = message.senderId === currentUserId

  return (
    <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white dark:bg-[#1A1A1A] rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white space-y-3.5">
      {/* ── Header : Auteur + Question ────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-100 dark:border-gray-700">
            {senderProfile?.avatarUrl ? (
              <SafeImage
                src={senderProfile.avatarUrl}
                alt={senderProfile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-xs text-gray-400">
                {senderProfile?.displayName?.[0] || 'O'}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate text-gray-800 dark:text-gray-200">
              {senderProfile?.displayName || 'Membre'}{' '}
              <span className="text-[11px] font-normal text-gray-400">· {isCreator ? 'Vous' : 'Créateur'}</span>
            </p>
          </div>
        </div>

        <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
          {poll.question}
        </h4>
      </div>

      {/* ── Options ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const voteCount = opt.votes?.length || 0
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
          const isMyVote = opt.votes?.some((v) => v.userId === currentUserId)
          const myVoteObj = opt.votes?.find((v) => v.userId === currentUserId)
          const isCurrentlyVoting = votingOptionId === opt.id

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isExpired || isCurrentlyVoting}
              onClick={() => handleVote(opt.id)}
              className={`relative w-full overflow-hidden text-left py-3 px-4 rounded-2xl border transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${
                isMyVote
                  ? 'bg-black dark:bg-[#2A2A2A] text-white border-transparent shadow-sm'
                  : 'bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border-gray-200/80 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              {/* Progress bar background */}
              {totalVotes > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 rounded-2xl ${
                    isMyVote
                      ? 'bg-black dark:bg-white/20'
                      : 'bg-gray-200/70 dark:bg-white/10'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}

              {/* Option label */}
              <div className="relative z-10 font-semibold text-xs truncate flex-1">
                {opt.text}
              </div>

              {/* Stats & voter avatar on the right */}
              <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                {isCurrentlyVoting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF7A00]" />
                ) : (
                  <>
                    {/* User's avatar thumbnail if selected */}
                    {isMyVote && (
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-white/40 shrink-0 bg-gray-600">
                        {myVoteObj?.user?.profile?.avatarUrl ? (
                          <SafeImage
                            src={myVoteObj.user.profile.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white">
                            ✓
                          </div>
                        )}
                      </div>
                    )}
                    <span className={`text-xs font-bold ${isMyVote ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {totalVotes > 0 ? `${percentage}%` : '0%'}
                    </span>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-800/60">
        <span>
          {totalVotes} vote{totalVotes > 1 ? 's' : ''}
          {remainingTimeStr ? ` · ${remainingTimeStr}` : ''}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">
          1 choix par personne
        </span>
      </div>
    </div>
  )
}

