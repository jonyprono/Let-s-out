import { Fragment, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Loader2, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useConfirm } from '@/components/shared/ConfirmContext'
import { intlLocale } from '@/lib/locale'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { displayNameOf, mentionOf, type CommentSource, type SocialComment } from '../api'
import { useCommentThread } from '../useCommentThread'

interface Props {
  source: CommentSource
  enabled: boolean
  /** Badge « Auteur » sur les commentaires de cet utilisateur (créateur de la page / du vlog) */
  authorUserId?: string
  /** Utilisateur autorisé à supprimer tous les commentaires (modération), en plus de leurs auteurs */
  moderatorUserId?: string
  /** Fond de la zone de saisie (s'accorde à la fiche qui l'accueille) */
  composerClassName?: string
  /**
   * `sheet` (défaut) : liste défilante + saisie en bas (fiche de commentaires).
   * `inline` : la liste suit le défilement du parent (sous une publication) et la saisie
   * reste collée en bas de la zone qui défile.
   */
  layout?: 'sheet' | 'inline'
}

/** « à l'instant », « 5 min », « 3 h », « 2 j », puis la date */
function useRelativeTime() {
  const { t } = useTranslation()
  return (iso: string) => {
    const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
    if (diffSec < 60) return t('social.justNow')
    const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto', style: 'narrow' })
    if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute')
    if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour')
    if (diffSec < 7 * 86400) return rtf.format(-Math.floor(diffSec / 86400), 'day')
    return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(new Date(iso))
  }
}

/** Texte avec les @mentions en orange */
function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@[\p{L}\p{N}_.-]+)/u)
  return (
    <p className="text-[14px] text-gray-800 dark:text-gray-200 leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((p, i) => (p.startsWith('@')
        ? <span key={i} className="font-semibold text-[#FF7A00]">{p}</span>
        : <Fragment key={i}>{p}</Fragment>))}
    </p>
  )
}

function Avatar({ comment, size }: { comment: SocialComment; size: 'sm' | 'md' }) {
  const name = displayNameOf(comment.user)
  const cls = size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[10px]'
  return (
    <div className={`${cls} rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700`}>
      {comment.user.profile?.avatarUrl
        ? <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center font-bold text-[#FF7A00] bg-orange-50 dark:bg-orange-950/30">{name[0]?.toUpperCase() ?? '?'}</div>}
    </div>
  )
}

/**
 * Fil de commentaires style Instagram / TikTok : cœur + compteur, « Répondre » (mention @pseudo),
 * réponses en retrait (1 niveau) repliables, suppression par l'auteur ou le modérateur.
 */
export function CommentThreadPanel({ source, enabled, authorUserId, moderatorUserId, composerClassName, layout = 'sheet' }: Props) {
  const inline = layout === 'inline'
  const { t } = useTranslation()
  const me = useAuthStore((s) => s.user)
  const confirm = useConfirm()
  const { openUserProfile } = useUserProfile()
  const relTime = useRelativeTime()
  const { comments, isLoading, isError, refetch, add, like, remove } = useCommentThread(source, enabled)

  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ rootId: string; name: string; mention: string } | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const canDelete = (c: SocialComment) => !!me && (c.userId === me.id || me.id === moderatorUserId)

  const startReply = (c: SocialComment, rootId: string) => {
    if (!me) { toast.info(t('social.loginToComment')); return }
    const mention = mentionOf(c.user)
    setReplyTo({ rootId, name: displayNameOf(c.user), mention })
    setText((prev) => (prev.startsWith(mention) ? prev : `${mention} `))
    setExpanded((e) => ({ ...e, [rootId]: true }))
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    })
  }

  const cancelReply = () => {
    if (replyTo && text.trim() === replyTo.mention) setText('')
    setReplyTo(null)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || add.isPending) return
    // Mention seule sans message : rien à envoyer
    if (replyTo && value === replyTo.mention) return
    add.mutate({ text: value, parentId: replyTo?.rootId ?? null }, {
      onSuccess: () => { setText(''); if (replyTo) setExpanded((x) => ({ ...x, [replyTo.rootId]: true })); setReplyTo(null) },
      onError: (err: any) => toast.error(err?.response?.data?.error || t('social.sendError')),
    })
  }

  const askDelete = async (c: SocialComment) => {
    const ok = await confirm({
      title: t('social.deleteTitle'),
      description: (c.replies?.length ?? 0) > 0 ? t('social.deleteWithReplies') : t('social.deleteIrreversible'),
      confirmText: t('social.delete'),
      variant: 'danger',
    })
    if (!ok) return
    remove.mutate(c.id, {
      onSuccess: () => toast.success(t('social.deleted')),
      onError: () => toast.error(t('social.deleteError')),
    })
  }

  const renderComment = (c: SocialComment, rootId: string, isReply: boolean) => {
    const name = displayNameOf(c.user)
    return (
      <div key={c.id} className="flex gap-3">
        <button type="button" onClick={() => openUserProfile(c.userId)} className="shrink-0" aria-label={name}>
          <Avatar comment={c} size={isReply ? 'sm' : 'md'} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
            <button type="button" onClick={() => openUserProfile(c.userId)} className="font-semibold text-[13px] text-gray-900 dark:text-white truncate max-w-[60%]">
              <span>{name}</span>
            </button>
            {authorUserId && c.userId === authorUserId && (
              <span className="bg-[#FFF1E5] dark:bg-[#FF7A00]/20 text-[#FF7A00] text-[10px] font-bold px-1.5 py-0.5 rounded-sm"><span>{t('social.author')}</span></span>
            )}
            <span className="text-[12px] text-gray-400"><span>{relTime(c.createdAt)}</span></span>
          </div>
          <CommentText text={c.content || c.text} />
          <div className="flex items-center gap-4 mt-1">
            <button type="button" onClick={() => startReply(c, rootId)} className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 active:opacity-60">
              <span>{t('social.reply')}</span>
            </button>
            {canDelete(c) && (
              <button type="button" onClick={() => askDelete(c)} className="text-gray-400 active:text-red-500" aria-label={t('social.delete')}>
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {/* Cœur discret à droite + compteur */}
        <button
          type="button"
          onClick={() => { if (!me) { toast.info(t('social.loginToLike')); return } like.mutate({ comment: c }) }}
          aria-pressed={c.likedByMe}
          aria-label={c.likedByMe ? t('social.unlike') : t('social.like')}
          className="shrink-0 w-8 flex flex-col items-center pt-1 gap-0.5 active:scale-90 transition-transform"
        >
          <Heart className={`w-4 h-4 transition-colors ${c.likedByMe ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} aria-hidden="true" />
          {c.likesCount > 0 && <span className={`text-[11px] ${c.likedByMe ? 'text-red-500' : 'text-gray-400'}`}>{c.likesCount}</span>}
        </button>
      </div>
    )
  }

  const total = useMemo(() => comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0), [comments])

  return (
    <div className={inline ? '' : 'flex-1 min-h-0 flex flex-col'}>
      <div className={inline ? 'px-4 py-4 space-y-5' : 'flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-5'} aria-live="polite" data-comment-total={total}>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" aria-hidden="true" /></div>
        ) : isError ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500"><span>{t('social.loadError')}</span></p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-semibold text-[#FF7A00]"><span>{t('social.retry')}</span></button>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-14 text-gray-400 text-sm"><span>{t('social.empty')}</span></div>
        ) : comments.map((root) => {
          const replies = root.replies ?? []
          const open = !!expanded[root.id]
          return (
            <div key={root.id} className="space-y-3">
              {renderComment(root, root.id, false)}
              {replies.length > 0 && (
                <div className="pl-12 space-y-3">
                  {open && replies.map((r) => renderComment(r, root.id, true))}
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [root.id]: !open }))}
                    className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 dark:text-gray-400"
                  >
                    <span className="w-6 h-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
                    <span>{open ? t('social.hideReplies') : t('social.viewReplies', { count: replies.length })}</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div
        className={`${inline ? 'sticky bottom-0 z-10' : 'flex-shrink-0'} border-t border-gray-100 dark:border-white/10 px-4 pt-2 ${composerClassName ?? 'bg-white dark:bg-[#1A1A1A]'}`}
        style={{ paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
      >
        {replyTo && (
          <div className="flex items-center justify-between text-[12px] text-gray-500 dark:text-gray-400 pb-2">
            <span className="truncate"><span>{t('social.replyingTo', { name: replyTo.name })}</span></span>
            <button type="button" onClick={cancelReply} aria-label={t('social.cancelReply')} className="p-1 -mr-1">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {me ? (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              enterKeyHint="send"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={replyTo ? t('social.replyPlaceholder', { name: replyTo.name }) : t('social.placeholder')}
              className="flex-1 min-w-0 h-10 bg-gray-100 dark:bg-white/10 rounded-full px-4 text-[16px] text-gray-900 dark:text-white placeholder-gray-400 outline-none border border-transparent focus:border-[#FF7A00]/50"
            />
            <button
              type="submit"
              disabled={!text.trim() || add.isPending || (!!replyTo && text.trim() === replyTo.mention)}
              aria-label={t('social.send')}
              className="w-10 h-10 shrink-0 rounded-full bg-[#FF7A00] flex items-center justify-center text-white disabled:opacity-40 active:scale-95 transition-transform"
            >
              {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4 ml-0.5" aria-hidden="true" />}
            </button>
          </form>
        ) : (
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2"><span>{t('social.loginToComment')}</span></p>
        )}
      </div>
    </div>
  )
}
