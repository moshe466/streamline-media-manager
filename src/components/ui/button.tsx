import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-400/20 bg-cyan-500/15 text-cyan-100 shadow-[0_0_22px_rgba(0,212,255,0.08)] hover:bg-cyan-500/25 hover:border-cyan-300/40",
        destructive:
          "border border-red-400/25 bg-red-500/15 text-red-100 hover:bg-red-500/25",
        outline:
          "border border-cyan-500/15 bg-slate-950/60 text-slate-100 hover:bg-cyan-500/10 hover:text-cyan-100 hover:border-cyan-400/30",
        secondary:
          "border border-slate-700/60 bg-slate-900/80 text-slate-100 hover:bg-slate-800",
        ghost:
          "text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-100",
        link:
          "text-cyan-300 underline-offset-4 hover:underline",
        accent:
          "border border-cyan-400/25 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
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
