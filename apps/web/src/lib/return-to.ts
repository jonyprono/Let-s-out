/**
 * Page à rouvrir après connexion / inscription (ex. lien partagé /videos/:id ouvert par un visiteur).
 *
 * - Mémorisée dans le stockage de session de l'onglet : survit au détour Google, aux étapes
 *   d'inscription et à l'onboarding, mais pas à la fermeture de l'onglet.
 * - Expire après RETURN_TO_MAX_AGE_MS (un vieux lien ne redirige pas des heures plus tard).
 * - Chemins INTERNES uniquement (anti redirection ouverte vers un site extérieur), jamais vers
 *   les écrans d'authentification eux-mêmes.
 */
const KEY = 'letsout_return_to'
const RETURN_TO_MAX_AGE_MS = 30 * 60 * 1000
const AUTH_PATHS = ['/login', '/signup', '/app', '/welcome', '/onboarding', '/forgot-password']

export function isSafeReturnPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length > 512) return false
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false
  if (/[\r\n]/.test(path) || /^\/[^/]*:/.test(path)) return false
  const pathname = path.split(/[?#]/)[0]
  return !AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export function rememberReturnTo(path: string): void {
  if (!isSafeReturnPath(path)) return
  try { sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })) } catch { /* stockage indisponible */ }
}

export function peekReturnTo(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number }
    if (!isSafeReturnPath(path) || !at || Date.now() - at > RETURN_TO_MAX_AGE_MS) {
      sessionStorage.removeItem(KEY)
      return null
    }
    return path
  } catch {
    return null
  }
}

export function clearReturnTo(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* stockage indisponible */ }
}

/** Destination après authentification : la page demandée si elle existe, sinon l'accueil */
export function postAuthPath(fallback = '/home'): string {
  return peekReturnTo() ?? fallback
}

/** Lit `?redirect=` (liens « S'inscrire » / « Se connecter » de l'écran d'invitation) et le mémorise */
export function captureRedirectParam(search: string): void {
  try {
    const redirect = new URLSearchParams(search).get('redirect')
    if (redirect) rememberReturnTo(redirect)
  } catch { /* paramètre invalide : ignoré */ }
}

/** Lien vers un écran d'authentification qui ramènera à `path` */
export function authLinkWithReturn(screen: '/login' | '/signup', path: string): string {
  return isSafeReturnPath(path) ? `${screen}?redirect=${encodeURIComponent(path)}` : screen
}
