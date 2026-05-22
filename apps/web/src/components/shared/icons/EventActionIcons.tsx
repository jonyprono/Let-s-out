/** Icônes Figma — écran post-création événement */

export function CagnotteAddIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="3" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="7" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="14" cy="9" r="2" fill="currentColor" />
    </svg>
  )
}

export function PublishEventIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M4 10.5v3c0 1.1.9 2 2 2h7.2l3.5 2.6c.7.5 1.3 0 1.3-.8v-8.6c0-.8-.6-1.3-1.3-.8L13.2 10.5H6c-1.1 0-2 .9-2 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M18 7v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M21 9v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}
