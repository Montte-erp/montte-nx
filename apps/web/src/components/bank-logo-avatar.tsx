"use client";

import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { cn } from "@packages/ui/lib/utils";
import { Landmark } from "lucide-react";
import { useState } from "react";
import { bankColor, bankInitials, bankLogoSources } from "@/lib/logos";

type BankLogoAvatarProps = {
   bankCode?: string | null;
   bankName?: string | null;
   color?: string | null;
   imageClassName?: string;
   logoDevToken?: string;
   name: string;
   size?: "sm" | "md";
};

export function BankLogoAvatar({
   bankCode,
   bankName,
   color,
   imageClassName,
   logoDevToken,
   name,
   size = "sm",
}: BankLogoAvatarProps) {
   const sourceKey = `${bankCode ?? ""}:${bankName ?? ""}:${logoDevToken ?? ""}`;
   const [failedSource, setFailedSource] = useState({
      sourceKey: "",
      index: 0,
   });
   const sources = bankLogoSources(bankCode, logoDevToken, bankName);
   const sourceIndex =
      failedSource.sourceKey === sourceKey ? failedSource.index : 0;
   const source = sources[sourceIndex];
   const label = bankName?.trim() || name;
   const fallbackLabel = label.trim();
   const backgroundColor = color ?? bankColor(bankCode) ?? "#6366f1";
   const sizeClassName = size === "md" ? "size-6" : "size-4";
   const iconSizeClassName = size === "md" ? "size-3" : "size-2";

   return (
      <Avatar
         className={cn("shrink-0 rounded-lg ring-1 ring-border", sizeClassName)}
         style={{ backgroundColor }}
      >
         {source ? (
            <AvatarImage
               alt={label}
               className={cn("object-contain", imageClassName)}
               onError={() =>
                  setFailedSource({
                     sourceKey,
                     index: sourceIndex + 1,
                  })
               }
               referrerPolicy="origin"
               src={source}
            />
         ) : null}
         <AvatarFallback
            className="rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor }}
         >
            {fallbackLabel ? (
               bankInitials(fallbackLabel)
            ) : (
               <Landmark className={iconSizeClassName} />
            )}
         </AvatarFallback>
      </Avatar>
   );
}
