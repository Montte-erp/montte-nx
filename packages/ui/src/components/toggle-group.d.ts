import { toggleVariants } from "@packages/ui/components/toggle";
import type { VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";
declare function ToggleGroup({
   className,
   variant,
   size,
   spacing,
   children,
   ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
   VariantProps<typeof toggleVariants> & {
      spacing?: number;
   }): import("react/jsx-runtime").JSX.Element;
declare function ToggleGroupItem({
   className,
   children,
   variant,
   size,
   ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
   VariantProps<
      typeof toggleVariants
   >): import("react/jsx-runtime").JSX.Element;
export { ToggleGroup, ToggleGroupItem };
//# sourceMappingURL=toggle-group.d.ts.map
