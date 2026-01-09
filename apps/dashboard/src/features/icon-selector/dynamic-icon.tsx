import type { CSSProperties } from "react";
import { cn } from "@packages/ui/lib/utils";
import type { IconName } from "./lib/available-icons";
import { getIconComponent } from "./lib/available-icons";

interface DynamicIconProps {
   name: string;
   style?: CSSProperties;
   className?: string;
}

export function DynamicIcon({ name, style, className }: DynamicIconProps) {
   const IconComponent = getIconComponent(name as IconName);

   if (!IconComponent) {
      return null;
   }

   return <IconComponent className={cn("size-4", className)} style={style} />;
}
