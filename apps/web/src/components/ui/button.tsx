import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: h-[52px] pour être en capsule, même hauteur que les inputs, rounded-full
  "inline-flex items-center justify-center whitespace-nowrap rounded-full h-[52px] font-poppins font-semibold text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-primary)] disabled:pointer-events-none disabled:opacity-50 gap-2",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-action-primary)] text-white hover:bg-[var(--color-action-primary-active)] shadow-sm",
        secondary:
          "bg-[var(--color-background-primary-muted)] text-[var(--color-text-brand-primary)] hover:bg-[var(--color-background-brand-tertiary)] hover:text-white",
        outline:
          "border border-[var(--border-default)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]",
        ghost:
          "text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]",
      },
      size: {
        default: "w-full px-6",
        sm: "h-[38px] px-4 text-[13px]",
        lg: "h-[56px] px-8 text-[16px]",
        icon: "h-[44px] w-[44px] rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
