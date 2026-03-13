import { type VariantProps } from "class-variance-authority";
import type * as React from "react";
declare const buttonVariants: (
   props?:
      | ({
           variant?:
              | "default"
              | "destructive"
              | "ghost"
              | "link"
              | "outline"
              | "secondary"
              | null
              | undefined;
           size?:
              | "default"
              | "icon"
              | "icon-lg"
              | "icon-sm"
              | "icon-xs"
              | "lg"
              | "sm"
              | "xs"
              | null
              | undefined;
        } & import("class-variance-authority/types").ClassProp)
      | undefined,
) => string;
declare function Button({
   className,
   variant,
   size,
   asChild,
   tooltip,
   tooltipSide,
   ...props
}: React.ComponentProps<"button"> &
   VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      tooltip?: string;
      tooltipSide?: "top" | "bottom" | "left" | "right";
   }): import("react/jsx-runtime").JSX.Element;
export { Button, buttonVariants };
//# sourceMappingURL=button.d.ts.map
