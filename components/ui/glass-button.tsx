import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "relative isolate cursor-pointer rounded-[6px] transition-all duration-300 inline-flex items-center justify-center overflow-hidden font-mono no-underline text-inherit",
  {
    variants: {
      size: {
        default: "text-base font-bold min-h-[44px]",
        sm: "text-[11px] font-bold uppercase tracking-[0.15em] min-h-[38px]",
        lg: "text-lg font-bold min-h-[56px]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const glassButtonTextVariants = cva(
  "glass-button-text relative z-10 block select-none w-full h-full flex items-center justify-center",
  {
    variants: {
      size: {
        default: "px-16 py-2.5",
        sm: "px-12 py-2",
        lg: "px-20 py-4",
        icon: "flex h-10 w-10 items-center justify-center",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
  asChild?: boolean;
}

/**
 * GlassButton
 * 
 * A premium glassmorphism button component with inner glow, 
 * backdrop blur, and subtle hover interactions.
 * Supports 'asChild' for seamless integration with Next.js Link.
 */
const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <div
        className={cn(
          "glass-button-wrap group relative inline-block",
          className
        )}
      >
        <Comp
          className={cn(
            "glass-button",
            glassButtonVariants({ size })
          )}
          ref={ref}
          {...props}
        >
          {asChild ? (
            children
          ) : (
            <span
              className={cn(
                glassButtonTextVariants({ size }),
                contentClassName
              )}
            >
              {children}
            </span>
          )}
        </Comp>

        {/* Decorative Overlays (placed outside Slot to avoid Children.only error) */}
        <div className="absolute inset-0 z-0 pointer-events-none rounded-[6px] overflow-hidden">
           <div className="absolute inset-0 bg-white/5 opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        
        {/* Soft Drop Shadow */}
        <div className="glass-button-shadow absolute -bottom-1 left-1/2 h-full w-[90%] -translate-x-1/2 rounded-[6px] bg-black/20 blur-md transition-opacity duration-300 group-hover:opacity-100 opacity-0 pointer-events-none" />
      </div>
    );
  }
);
GlassButton.displayName = "GlassButton";

export { GlassButton, glassButtonVariants };
