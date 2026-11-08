import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-brand-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-[0.98]",
        destructive:
          "border border-red-500/30 bg-red-500/10 text-red-400 shadow-sm hover:bg-red-500/20 hover:border-red-500/50 active:scale-[0.98]",
        outline:
          "border border-border-default bg-surface-card/60 text-text-secondary shadow-sm hover:border-border-hover hover:bg-surface-elevated/80 hover:text-white active:scale-[0.98]",
        secondary:
          "bg-surface-card text-text-secondary border border-border-subtle shadow-sm hover:bg-surface-hover hover:text-white active:scale-[0.98]",
        ghost:
          "text-text-muted hover:bg-surface-card hover:text-text-primary",
        link:
          "text-text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
