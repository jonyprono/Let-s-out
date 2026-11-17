import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'

/**
 * Liens de partage DIRECTS vers une ressource (deep linking) : ouvrent la vidéo / la publication
 * exacte (routes /videos/:id et /posts/:id), avec inscription obligatoire pour les visiteurs.
 * Domaine public de l'app (surcharge possible : VITE_PUBLIC_APP_URL).
 */
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, '') || 'https://letsout.app'

export type ShareTarget = { kind: 'video'; id: string } | { kind: 'post'; id: string }

export function shareUrl(target: ShareTarget): string {
  return `${PUBLIC_APP_URL}/${target.kind === 'video' ? 'videos' : 'posts'}/${encodeURIComponent(target.id)}`
}

/**
 * Partage natif (app) → partage du navigateur → copie du lien. Une annulation par
 * l'utilisateur n'affiche rien.
 */
export async function shareContent(target: ShareTarget, opts: { title?: string; text?: string } = {}): Promise<void> {
  const url = shareUrl(target)
  const title = opts.title || "Let's Out"
  const text = opts.text?.trim() ? opts.text.trim().slice(0, 200) : undefined
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text, url, dialogTitle: title })
      return
    }
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return
    }
    await copyLink(url)
  } catch (err: any) {
    if (err?.name === 'AbortError' || /cancel/i.test(String(err?.message))) return
    await copyLink(url)
  }
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success(i18n.t('social.linkCopied'))
  } catch {
    toast.error(i18n.t('social.shareError'))
  }
}
