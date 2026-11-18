import { Capacitor } from '@capacitor/core'

/**
 * Liens des fiches de l'application sur les stores (« Noter l'app », bannière de téléchargement).
 * - Android : identifiant du paquet = appId Capacitor = applicationId Gradle = packageName du
 *   déploiement Play (com.fihodecorp.letsout). L'ancien lien utilisait « app.letsout.android »,
 *   inexistant → « Élément introuvable » sur le Play Store.
 * - iOS : l'URL App Store exige l'identifiant NUMÉRIQUE Apple (App Store Connect → Informations sur
 *   l'app → Identifiant Apple), à renseigner dans VITE_IOS_APP_STORE_ID à la sortie publique.
 *   Tant qu'il est absent, aucun lien App Store n'est proposé (plus de lien cassé).
 */
export const ANDROID_PACKAGE_ID = 'com.fihodecorp.letsout'
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`

const IOS_APP_STORE_ID = String(import.meta.env.VITE_IOS_APP_STORE_ID ?? '').trim()
export const APP_STORE_URL: string | null = /^\d+$/.test(IOS_APP_STORE_ID)
  ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`
  : null

/** Fiches à proposer pour noter l'app selon la plateforme (vide = rien à proposer) */
export function rateTargets(): { playStore: boolean; appStore: boolean } {
  const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
  return {
    playStore: platform !== 'ios',
    appStore: !!APP_STORE_URL && platform !== 'android',
  }
}

/**
 * Ouvre une fiche store. Dans l'app native : navigateur intégré Capacitor (window.open est bloqué
 * ou ignoré dans la WebView) ; sur le web : nouvel onglet.
 */
export async function openStoreUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
