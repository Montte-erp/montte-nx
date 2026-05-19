import { cn } from "@packages/ui/lib/utils";

interface EmptyStateProps {
   variant: "panel" | "page";
}

export function EmptyState({ variant }: EmptyStateProps) {
   const isPage = variant === "page";

   return (
      <div
         className={cn(
            "flex flex-col items-center justify-center gap-4",
            isPage && "gap-6",
         )}
      >
         <img
            alt=""
            aria-hidden="true"
            className={cn(isPage ? "size-24" : "size-12")}
            draggable={false}
            src="/mascot.svg"
         />
         <div className="flex flex-col items-center gap-2 text-center">
            <h1
               className={cn("font-semibold", isPage ? "text-2xl" : "text-lg")}
            >
               Como posso te ajudar?
            </h1>
            <p
               className={cn(
                  "italic text-muted-foreground",
                  isPage ? "text-sm" : "text-xs",
               )}
            >
               Gerencie seu negócio com inteligência.
            </p>
         </div>
      </div>
   );
}
