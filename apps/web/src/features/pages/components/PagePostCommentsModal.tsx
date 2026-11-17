import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countComments, pagePostCommentSource } from '@/features/social/api'
import { CommentThreadPanel } from '@/features/social/components/CommentThreadPanel'

interface PagePostCommentsModalProps {
  pageId: string
  postId: string
  pageName?: string
  pageCreatorId?: string
  open: boolean
  onClose: () => void
  onCommentAdded?: () => void
}

/**
 * Hauteur masquée par le clavier virtuel, via visualViewport.
 * Safari / navigateur mobile : la page n'est pas redimensionnée → la valeur sert à remonter la fiche.
 * App Capacitor (resize: 'native') : la vue est déjà redimensionnée → la valeur reste ~0.
 */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) return
    const update = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop
      setInset(hidden > 80 ? Math.round(hidden) : 0) // ignore les petites variations (barre d'adresse)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return inset
}

export function PagePostCommentsModal({
  pageId,
  postId,
  pageName,
  pageCreatorId,
  open,
  onClose,
  onCommentAdded,
}: PagePostCommentsModalProps) {
  const { t } = useTranslation()
  const baseSource = useMemo(() => pagePostCommentSource(pageId, postId), [pageId, postId])
  // Prévient le parent après un ajout (compteur local des anciennes cartes)
  const source = useMemo(() => ({
    ...baseSource,
    add: async (text: string, parentId: string | null) => { const r = await baseSource.add(text, parentId); onCommentAdded?.(); return r },
  }), [baseSource, onCommentAdded])
  // Même clé que le panneau : lecture partagée en cache (aucune requête en plus) pour le compteur
  const { data: comments = [] } = useQuery({ queryKey: source.queryKey, queryFn: source.list, enabled: open && Boolean(pageId && postId) })
  const total = countComments(comments)

  const keyboardInset = useKeyboardInset(open)

  // Bloque le défilement de la page derrière la fiche (web / Safari)
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  if (!open) return null

  // Portal sur <body> : rendue dans la carte du fil, la fiche était enfermée dans la zone qui
  // défile et, sur iOS (défilement composité), rognée/décalée hors de l'écran.
  // z-[110] : au-dessus du plein écran vidéo (90) et de la fiche publication (100),
  // sous les confirmations (150).
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end overscroll-contain"
      onClick={onClose}
      style={{
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(2px)',
        // Clavier : remonte la fiche de la hauteur masquée par le clavier (Safari / web).
        // Dans l'app, Capacitor redimensionne déjà la vue (resize: native) → valeur 0.
        paddingBottom: keyboardInset,
      }}
    >
      {/* Sheet — hauteurs en dvh : suivent la zone réellement visible (clavier compris) */}
      <div
        className="w-full flex flex-col rounded-t-3xl overflow-hidden relative"
        style={{
          height: '85dvh',
          maxHeight: keyboardInset ? `calc(100dvh - ${keyboardInset}px - 24px)` : '90dvh',
          background: 'var(--color-background-primary, #fff)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
          animation: 'slideUp 0.3s cubic-bezier(.32,1.06,.55,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 flex-shrink-0 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">
              <span>{t('social.title', { count: total })}</span>
            </h2>
            {pageName && (
              <p className="text-xs text-gray-400 mt-0.5">
                <span>{t('social.postOf', { name: pageName })}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Fil de commentaires (likes, réponses) + saisie ── */}
        <CommentThreadPanel
          source={source}
          enabled={open}
          authorUserId={pageCreatorId}
          moderatorUserId={pageCreatorId}
          composerClassName="bg-white dark:bg-[#111]"
        />
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>,
    document.body,
  )
}
