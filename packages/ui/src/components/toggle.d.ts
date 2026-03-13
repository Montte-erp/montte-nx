import { type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type * as React from "react";
declare const toggleVariants: (
   props?:
      | ({
           size?: "default" | "lg" | "sm" | null | undefined;
           variant?: "default" | "outline" | null | undefined;
        } & import("class-variance-authority/types").ClassProp)
      | undefined,
) => string;
declare function Toggle({
   className,
   variant,
   size,
   ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
   VariantProps<
      typeof toggleVariants
   >): import("react/jsx-runtime").JSX.Element;
export { Toggle, toggleVariants };
//# sourceMappingURL=toggle.d.ts.map
