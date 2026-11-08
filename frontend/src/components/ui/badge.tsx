import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors focus:outline-none focus:ring-1 focus:ring-brand-primary",
  {
    variants: {
      variant: {
        default: "border-border-default bg-surface-card text-text-secondary",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400 font-semibold",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold",
        secondary: "border-border-subtle bg-surface-base text-text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
