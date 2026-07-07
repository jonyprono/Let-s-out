import { X, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ImageLightboxProps {
  src: string | null
  label: string
  className?: string
}

export function ImageLightbox({ src, label, className }: ImageLightboxProps) {
  const [open, setOpen] = useState(false)

  if (!src) {
    return (
      <div className={cn('rounded-2xl border border-dashed border-border bg-muted/40 flex items-center justify-center aspect-[4/3] text-muted-foreground text-sm', className)}>
        Non fourni
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('group relative rounded-2xl overflow-hidden border border-border bg-muted aspect-[4/3] w-full', className)}
      >
        <img src={src} alt={label} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="absolute bottom-2 left-2 text-[11px] font-medium text-white bg-black/50 px-2 py-0.5 rounded-md">{label}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A]/10 flex items-center justify-center text-white"
            onClick={() => setOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <p className="text-white/80 text-sm mb-3">{label}</p>
          <img
            src={src}
            alt={label}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
