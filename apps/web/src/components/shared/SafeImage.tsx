import { useState, useEffect } from 'react'

const API_BASE = (() => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/api\/v1\/?$/, '')
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin
    if (origin.includes('vercel.app') || origin.includes('let-s-out-web')) {
      return 'https://let-s-out.onrender.com'
    }
    if (origin.includes(':3000')) return origin.replace(':3000', ':3001')
    
    const isCap = () => {
      try { return !!(window as any).Capacitor?.isNativePlatform?.() } catch { return false }
    }
    if (isCap() && process.env.NODE_ENV === 'production') {
      return 'https://let-s-out.onrender.com'
    }
    
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
  /** Appended as query param to bust cache after profile updates */
  cacheKey?: string | number | null
}

function resolveImageSrc(src: string): string {
  const normalizedSrc = src.replace(/\\/g, '/')
  const fixedSrc = normalizedSrc
    .replace(/http:\/\/localhost:\d+/g, API_BASE)
    .replace(/http:\/\/127\.0\.0\.1:\d+/g, API_BASE)

  let finalSrc = (!fixedSrc.startsWith('http') && !fixedSrc.startsWith('data:') && !fixedSrc.startsWith('blob:'))
    ? `${API_BASE}${fixedSrc.startsWith('/') ? '' : '/'}${fixedSrc}`
    : fixedSrc

  // Apply auto format, auto quality, and sensible width for Cloudinary images
  if (finalSrc.includes('res.cloudinary.com') && finalSrc.includes('/upload/') && !finalSrc.includes('/upload/f_')) {
    finalSrc = finalSrc.replace('/upload/', '/upload/f_auto,q_auto,w_800/')
  }

  return finalSrc
}

export function SafeImage({ src, alt, className, fallback, onError, onLoad, style, priority, cacheKey, ...rest }: SafeImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Reset state when src changes (e.g. after avatar update)
  useEffect(() => {
    setError(false)
    setLoaded(false)
  }, [src, cacheKey])


  if (!src) {
    return (
      <div className={`bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center overflow-hidden ${className ?? ''}`} style={style}>
        {fallback ?? <span className="text-gray-300 text-2xl">👤</span>}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center overflow-hidden ${className ?? ''}`} style={style} title="Image failed to load">
        {fallback ?? <span className="text-gray-300 text-2xl">👤</span>}
      </div>
    )
  }

  let resolvedSrc = resolveImageSrc(src)
  if (cacheKey != null && cacheKey !== '' && !resolvedSrc.includes('res.cloudinary.com')) {
    const sep = resolvedSrc.includes('?') ? '&' : '?'
    resolvedSrc = `${resolvedSrc}${sep}v=${cacheKey}`
  }

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
