/**
 * « Retour en haut » de l'écran affiché, déclenché par :
 *  - un appui sur la barre d'état iOS (événement Capacitor `statusTap`, émis par @capacitor/status-bar) ;
 *  - un nouvel appui sur l'onglet déjà actif de la barre du bas ;
 *  - un appui sur le titre de l'en-tête.
 *
 * Les écrans de l'app ne font pas défiler la page elle-même mais un conteneur interne
 * (ex. accueil : `.ptr__children`). On retrouve donc le(s) conteneur(s) réellement défilé(s) de
 * l'écran actif, sans dépendre de chaque écran. Un écran peut écouter SCROLL_TO_TOP_EVENT pour
 * réagir en plus (ex. redéployer son en-tête) ; s'il appelle preventDefault(), il gère seul le défilement.
 */
export const SCROLL_TO_TOP_EVENT = 'letsout:scroll-to-top'

function scrollBehavior(): ScrollBehavior {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'auto'
  } catch { /* navigateur ancien */ }
  return 'smooth'
}

function isVerticallyScrolled(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.scrollTop <= 0) return false
  const oy = getComputedStyle(el).overflowY
  return oy === 'auto' || oy === 'scroll' || oy === 'overlay'
}

/** Remonte en haut le(s) conteneur(s) défilé(s) de l'écran affiché. Renvoie true si quelque chose a bougé. */
export function scrollActiveScreenToTop(): boolean {
  const root = document.querySelector('main') ?? document.body
  const targets = new Set<HTMLElement>()

  // 1) Chaîne des ancêtres de l'élément au centre de l'écran : trouve le conteneur réellement
  //    visible, même si l'écran contient d'autres zones défilantes cachées.
  const rect = root.getBoundingClientRect()
  const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
  for (let el: Element | null = hit; el && el !== document.documentElement; el = el.parentElement) {
    if (isVerticallyScrolled(el)) targets.add(el)
  }

  // 2) Repli : premier conteneur défilé visible de l'écran (lecture unique, seulement au tap)
  if (targets.size === 0 && root instanceof HTMLElement) {
    const all = root.querySelectorAll<HTMLElement>('*')
    for (let i = 0; i < all.length; i++) {
      const el = all[i]
      if (el.scrollTop > 0 && el.getClientRects().length > 0 && isVerticallyScrolled(el)) {
        targets.add(el)
        break
      }
    }
  }

  const behavior = scrollBehavior()
  targets.forEach((el) => el.scrollTo({ top: 0, behavior }))

  const doc = document.scrollingElement
  if (doc && doc.scrollTop > 0) {
    window.scrollTo({ top: 0, behavior })
    return true
  }
  return targets.size > 0
}

/** Demande un retour en haut : prévient les écrans à l'écoute, puis défile (sauf s'ils l'ont fait). */
export function requestScrollToTop() {
  const ev = new CustomEvent(SCROLL_TO_TOP_EVENT, { cancelable: true })
  window.dispatchEvent(ev)
  if (!ev.defaultPrevented) scrollActiveScreenToTop()
}
