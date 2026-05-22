import type { QueryClient } from '@tanstack/react-query'

/** Bust browser image cache when avatar URL changes */
export function avatarCacheKey(url?: string | null, version?: string | number | null): string | undefined {
  if (!url) return undefined
  if (!version) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${version}`
}

export function invalidateAvatarQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['events'] })
  qc.invalidateQueries({ queryKey: ['chat'] })
  qc.invalidateQueries({ queryKey: ['users'] })
  qc.invalidateQueries({ queryKey: ['public-profile'] })
}
