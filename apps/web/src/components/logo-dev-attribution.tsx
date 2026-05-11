import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { LOGO_DEV_ATTRIBUTION } from "@/lib/logos";

export function LogoDevAttribution({ className }: { className?: string }) {
   return (
      <a
         className={
            className ??
            "text-xs text-muted-foreground hover:underline self-end"
         }
         href={LOGO_DEV_ATTRIBUTION.url}
         rel="noopener noreferrer"
         target="_blank"
      >
         <Avatar className="size-4 rounded-md bg-white ring-1 ring-border">
            <AvatarImage
               alt="Logo.dev"
               className="object-contain"
               src={LOGO_DEV_ATTRIBUTION.logoUrl}
            />
            <AvatarFallback className="rounded-md text-[10px]">
               LD
            </AvatarFallback>
         </Avatar>
         {LOGO_DEV_ATTRIBUTION.text}
      </a>
   );
}
