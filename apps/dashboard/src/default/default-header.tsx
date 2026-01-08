import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@packages/ui/lib/utils";

interface DefaultHeaderProps {
   title: string;
   description: ReactNode;
   actions?: ReactNode;
}

export function DefaultHeader({
   title,
   description,
   actions,
}: DefaultHeaderProps) {
   const [isSticky, setIsSticky] = useState(false);
   const sentinelRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;

      const observer = new IntersectionObserver(
         (entries) => {
            const entry = entries[0];
            if (entry) {
               setIsSticky(!entry.isIntersecting);
            }
         },
         { threshold: 0 },
      );

      observer.observe(sentinel);
      return () => observer.disconnect();
   }, []);

   return (
      <>
         <div ref={sentinelRef} className="absolute top-0 h-px w-full" />
         <div
            className={cn(
               "sticky top-12 z-10 bg-background -mx-4 px-4 pt-4 pb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between transition-[border-color] duration-200",
               isSticky
                  ? "border-b border-border"
                  : "border-b border-transparent",
            )}
         >
            <div className="flex flex-col gap-2 min-w-0 flex-1 max-w-2xl">
               <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-serif leading-tight truncate">
                  {title}
               </h1>
               <div className="text-base md:text-lg text-muted-foreground font-sans leading-relaxed">
                  {description}
               </div>
            </div>
            {actions && (
               <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
         </div>
      </>
   );
}
