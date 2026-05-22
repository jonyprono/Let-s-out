/** URL absolue pour les fichiers servis par /uploads */
export function resolveUploadUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  let origin = ''
  if (apiBase) {
    origin = apiBase.replace(/\/api\/v1\/?$/, '')
  } else if (typeof window !== 'undefined') {
    const loc = window.location.origin
    origin = loc.includes(':3000') ? loc.replace(':3000', ':3001') : loc
  }

  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
