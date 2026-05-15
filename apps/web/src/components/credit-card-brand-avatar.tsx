"use client";

import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import {
   BRAND_COLOR,
   BRAND_LABEL,
   brandLogoSources,
   type CreditCardBrand,
} from "@/lib/logos";

type CreditCardBrandAvatarProps = {
   brand?: CreditCardBrand | null;
   logoDevToken?: string;
   size?: "sm" | "md";
};

export function CreditCardBrandAvatar({
   brand,
   logoDevToken,
   size = "sm",
}: CreditCardBrandAvatarProps) {
   const [failedSource, setFailedSource] = useState({
      brand: "",
      index: 0,
   });
   const sources = brand ? brandLogoSources(brand, logoDevToken) : [];
   const sourceIndex = failedSource.brand === brand ? failedSource.index : 0;
   const source = sources[sourceIndex];
   const color = brand
      ? (BRAND_COLOR[brand] ?? BRAND_COLOR.other ?? "#6366f1")
      : "#6366f1";
   const sizeClassName = size === "md" ? "size-4 ring-2" : "size-4";
   const iconSizeClassName = "size-2";
   const label = brand ? (BRAND_LABEL[brand] ?? brand) : "Bandeira";

   return (
      <Avatar
         className={`${sizeClassName} shrink-0 rounded-lg bg-white ring-1 ring-border`}
      >
         {source ? (
            <AvatarImage
               alt={label}
               className="object-contain"
               onError={() =>
                  setFailedSource({
                     brand: brand ?? "",
                     index: sourceIndex + 1,
                  })
               }
               referrerPolicy="origin"
               src={source}
            />
         ) : null}
         <AvatarFallback
            className="rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
         >
            {brand ? label[0] : <CreditCard className={iconSizeClassName} />}
         </AvatarFallback>
      </Avatar>
   );
}
