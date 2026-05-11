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
         {LOGO_DEV_ATTRIBUTION.text}
      </a>
   );
}
