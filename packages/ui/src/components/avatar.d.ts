import { Avatar as AvatarPrimitive } from "radix-ui";
import type * as React from "react";
declare function Avatar({
   className,
   size,
   ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
   size?: "default" | "sm" | "lg";
}): import("react/jsx-runtime").JSX.Element;
declare function AvatarImage({
   className,
   ...props
}: React.ComponentProps<
   typeof AvatarPrimitive.Image
>): import("react/jsx-runtime").JSX.Element;
declare function AvatarFallback({
   className,
   ...props
}: React.ComponentProps<
   typeof AvatarPrimitive.Fallback
>): import("react/jsx-runtime").JSX.Element;
declare function AvatarBadge({
   className,
   ...props
}: React.ComponentProps<"span">): import("react/jsx-runtime").JSX.Element;
declare function AvatarGroup({
   className,
   ...props
}: React.ComponentProps<"div">): import("react/jsx-runtime").JSX.Element;
declare function AvatarGroupCount({
   className,
   ...props
}: React.ComponentProps<"div">): import("react/jsx-runtime").JSX.Element;
export {
   Avatar,
   AvatarImage,
   AvatarFallback,
   AvatarBadge,
   AvatarGroup,
   AvatarGroupCount,
};
//# sourceMappingURL=avatar.d.ts.map
