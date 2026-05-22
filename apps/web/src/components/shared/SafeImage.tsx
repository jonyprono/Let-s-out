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
  priority?: boolean
}

export function SafeImage({ src, alt, className, fallback, onError, onLoad, style, priority, ...rest }: SafeImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

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
    <div className={`relative overflow-hidden ${className ?? ''}`} style={style}>
      {/* Shimmer skeleton shown while image is loading */}
      {!loaded && (
        <div
          className="absolute inset-0 bg-gray-200"
          style={{
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }}
        />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading={priority ? 'eager' : (rest.loading ?? 'eager')}
        decoding={priority ? 'sync' : (rest.decoding ?? 'auto')}
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
        onError={(e) => {
          setError(true)
          onError?.(e)
        }}
        {...rest}
      />
    </div>
  )
}
