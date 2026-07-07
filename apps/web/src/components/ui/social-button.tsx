import * as React from "react"
import { cn } from "@/lib/utils"

export interface SocialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  provider: "google" | "apple" | "facebook";
}

const SocialButton = React.forwardRef<HTMLButtonElement, SocialButtonProps>(
  ({ className, provider, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Même h-[var(--btn-height)] rounded-full que le bouton principal pour cohérence capsule
          "flex w-full h-[var(--btn-height)] items-center justify-center gap-[var(--spacing-150)] rounded-full border border-[var(--border-primary)] bg-[var(--color-background-primary)] px-6 font-poppins text-[16px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-primary)] disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {provider === "google" && (
          // Logo Google 20px (plus compact, alignement visuel parfait)
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.81 15.73 17.58V20.34H19.3C21.38 18.42 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
            <path d="M12 23C14.97 23 17.46 22.02 19.3 20.34L15.73 17.58C14.74 18.25 13.48 18.66 12 18.66C9.13 18.66 6.7 16.72 5.84 14.12H2.17V16.97C3.99 20.58 7.7 23 12 23Z" fill="#34A853"/>
            <path d="M5.84 14.12C5.62 13.47 5.5 12.76 5.5 12C5.5 11.24 5.62 10.53 5.84 9.88V7.03H2.17C1.43 8.5 1 10.19 1 12C1 13.81 1.43 15.5 2.17 16.97L5.84 14.12Z" fill="#FBBC05"/>
            <path d="M12 5.34C13.62 5.34 15.06 5.89 16.2 6.98L19.37 3.8C17.45 2 14.97 1 12 1C7.7 1 3.99 3.42 2.17 7.03L5.84 9.88C6.7 7.28 9.13 5.34 12 5.34Z" fill="#EA4335"/>
          </svg>
        )}
        <span>{children}</span>
      </button>
    )
  }
)
SocialButton.displayName = "SocialButton"

export { SocialButton }
