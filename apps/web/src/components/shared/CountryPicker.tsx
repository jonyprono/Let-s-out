import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { COUNTRIES, Country } from '@/lib/countries'

interface CountryPickerProps {
  value: Country
  onChange: (country: Country) => void
}

export function CountryPicker({ value, onChange }: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : COUNTRIES

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 80)
    } else {
      setSearch('')
    }
  }, [open])

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (c: Country) => {
    onChange(c)
    setOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-3 py-3.5 border border-[#E5E5E5] rounded-xl bg-white text-[15px] font-medium whitespace-nowrap active:bg-gray-50 transition-colors"
      >
        <span className="text-lg leading-none">{value.flag}</span>
        <span className="text-[#1A1A1A] text-[13px] ml-0.5">({value.code.replace('+', '')})</span>
        <ChevronDown className={`w-3 h-3 text-[#888888] ml-0.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E5E5] rounded-2xl shadow-2xl z-50 w-72 overflow-hidden"
          style={{ maxHeight: '60vh' }}
        >
          {/* Search bar */}
          <div className="px-3 py-2.5 border-b border-[#F0F0F0] sticky top-0 bg-white">
            <div className="flex items-center gap-2 bg-[#F5F5F5] rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-[#888888] shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="flex-1 bg-transparent text-[13px] text-[#1A1A1A] outline-none placeholder-[#AAAAAA]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="shrink-0">
                  <X className="w-3.5 h-3.5 text-[#AAAAAA]" />
                </button>
              )}
            </div>
          </div>

          {/* Country list */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 60px)', scrollbarWidth: 'none' }}>
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#AAAAAA]">Aucun pays trouvé</div>
            ) : (
              filtered.map((c, i) => (
                <button
                  key={`${c.code}-${i}`}
                  onClick={() => select(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FFF8F0] active:bg-[#FFF0DC] text-left transition-colors border-b border-[#F5F5F5] last:border-0 ${
                    value.code === c.code && value.name === c.name ? 'bg-[#FFF8F0]' : ''
                  }`}
                >
                  <span className="text-xl leading-none w-7 text-center">{c.flag}</span>
                  <span className="flex-1 text-[14px] text-[#1A1A1A] font-medium truncate">{c.name}</span>
                  <span className="text-[12px] text-[#888888] shrink-0">{c.code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
