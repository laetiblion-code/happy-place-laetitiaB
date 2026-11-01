import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Charte Option A : principal plein anthracite, secondaire blanc à bordure 1 px anthracite,
// destructif blanc à bordure et texte #C2272D. Cibles de 44 px minimum, focus anthracite 2 px.
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-xs whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:opacity-90",
        destructive: "border border-[#C2272D] bg-white text-[#C2272D] hover:bg-surface-container",
        outline: "border border-primary bg-white text-primary hover:bg-surface-container",
        secondary: "border border-primary bg-white text-primary hover:bg-surface-container",
        ghost: "text-primary hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-md py-xs",
        sm: "px-sm py-xs text-xs",
        lg: "px-lg py-xs",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
