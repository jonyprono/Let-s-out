import { cn } from '@/lib/utils'

interface VerifiedBadgeProps {
  size?: number
  className?: string
  title?: string
}

/**
 * Badge officiel de certification Let's Out :
 * Rosette orange (#FF7A00) avec coche blanche centrale.
 */
export function VerifiedBadge({
  size = 16,
  className,
  title = 'Profil vérifié',
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center justify-center shrink-0 select-none align-middle', className)}
      title={title}
      aria-label={title}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Rosette festive / badge orange */}
        <path
          d="M10.29 2.30864C11.0496 1.61546 12.2104 1.61546 12.97 2.30864L14.07 3.31215C14.4449 3.65416 14.9388 3.85873 15.4475 3.8827L16.9407 3.95304C17.9712 4.0016 18.7984 4.8288 18.847 5.85934L18.9173 7.35248C18.9413 7.86121 19.1458 8.35508 19.4879 8.73003L20.4914 9.83003C21.1845 10.5896 21.1845 11.7504 20.4914 12.51L19.4879 13.61C19.1458 13.9849 18.9413 14.4788 18.9173 14.9875L18.847 16.4807C18.7984 17.5112 17.9712 18.3384 16.9407 18.387L15.4475 18.4573C14.9388 18.4813 14.4449 18.6858 14.07 19.0279L12.97 20.0314C12.2104 20.7245 11.0496 20.7245 10.29 20.0314L9.19 19.0279C8.81508 18.6858 8.32121 18.4813 7.81248 18.4573L6.31934 18.387C5.2888 18.3384 4.4616 17.5112 4.41304 16.4807L4.3427 14.9875C4.31873 14.4788 4.11416 13.9849 3.77215 13.61L2.76864 12.51C2.07546 11.7504 2.07546 10.5896 2.76864 9.83003L3.77215 8.73003C4.11416 8.35508 4.31873 7.86121 4.3427 7.35248L4.41304 5.85934C4.4616 4.8288 5.2888 4.0016 6.31934 3.95304L7.81248 3.8827C8.32121 3.85873 8.81508 3.65416 9.19 3.31215L10.29 2.30864Z"
          fill="#FF7A00"
        />
        {/* Coche blanche nette */}
        <path
          d="M8.2 12.1L10.6 14.5L16.2 8.9"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

