/**
 * UserAvatarIcon — Reusable default user avatar (Figma SVG)
 * Used when a user has no profile picture.
 */
export function UserAvatarIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g clipPath="url(#uai-clip)">
        <rect width="32" height="32" rx="16" fill="#F5F5F5" />
        <circle cx="16" cy="10.6663" r="5.33333" fill="#BDBDBD" />
        <circle cx="16" cy="32.6667" r="14.6667" fill="#BDBDBD" />
      </g>
      <defs>
        <clipPath id="uai-clip">
          <rect width="32" height="32" rx="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
