import { useState } from 'react'

// ── Computed once at module load — never re-calculated per render ─────────────
const API_BASE = (() => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl) return envUrl.replace('/api/v1', '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin
    if (origin.includes(':3000')) return origin.replace(':3000', ':3001')
    return origin
  }
  return 'http://localhost:3001'
})()

// Omit 'src' from native attrs to allow null (native only accepts string | undefined)
interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null
  alt: string
  fallback?: React.ReactNode
}

export function SafeImage({ src, alt, className, fallback, onError, style, ...rest }: SafeImageProps) {
  const [error, setError] = useState(false)

  if (!src) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center overflow-hidden ${className ?? ''}`} style={style}>
        {fallback ?? <span className="text-gray-300 text-2xl">👤</span>}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center overflow-hidden ${className ?? ''}`} style={style} title="Image failed to load">
        {fallback ?? <span className="text-gray-300 text-2xl">👤</span>}
      </div>
    )
  }

  const normalizedSrc = src.replace(/\\/g, '/')
  const fixedSrc = normalizedSrc
    .replace(/http:\/\/localhost:\d+/g, API_BASE)
    .replace(/http:\/\/127\.0\.0\.1:\d+/g, API_BASE)

  const resolvedSrc = (!fixedSrc.startsWith('http') && !fixedSrc.startsWith('data:') && !fixedSrc.startsWith('blob:'))
    ? `${API_BASE}${fixedSrc.startsWith('/') ? '' : '/'}${fixedSrc}`
    : fixedSrc

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      loading={rest.loading ?? 'lazy'}
      decoding={rest.decoding ?? 'async'}
      onError={(e) => {
        setError(true)
        onError?.(e)
      }}
      {...rest}
    />
  )
}
