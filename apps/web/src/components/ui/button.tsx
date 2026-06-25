import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-large)] font-poppins font-medium text-[var(--font-size-body-medium)] leading-[var(--line-height-body-medium)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-brand-primary)] disabled:pointer-events-none disabled:opacity-50 gap-[var(--spacing-100)]",
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
        default: "h-[48px] px-[var(--spacing-200)]",
        sm: "h-[36px] px-[var(--spacing-150)] text-[var(--font-size-body-small)]",
        lg: "h-[56px] px-[var(--spacing-300)] text-[var(--font-size-title-xsmall)]",
        icon: "h-[44px] w-[44px]",
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
