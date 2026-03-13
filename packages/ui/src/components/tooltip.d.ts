import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";
declare function TooltipProvider({
   delayDuration,
   ...props
}: React.ComponentProps<
   typeof TooltipPrimitive.Provider
>): import("react/jsx-runtime").JSX.Element;
declare function Tooltip({
   ...props
}: React.ComponentProps<
   typeof TooltipPrimitive.Root
>): import("react/jsx-runtime").JSX.Element;
declare function TooltipTrigger({
   ...props
}: React.ComponentProps<
   typeof TooltipPrimitive.Trigger
>): import("react/jsx-runtime").JSX.Element;
declare function TooltipContent({
   className,
   sideOffset,
   children,
   ...props
}: React.ComponentProps<
   typeof TooltipPrimitive.Content
>): import("react/jsx-runtime").JSX.Element;
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
//# sourceMappingURL=tooltip.d.ts.map
