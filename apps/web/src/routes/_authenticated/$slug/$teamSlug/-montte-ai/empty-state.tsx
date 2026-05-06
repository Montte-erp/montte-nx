import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { SCOPE_SUGGESTIONS, selectScope } from "./chat-store";

interface EmptyStateProps {
   variant: "panel" | "page";
}

export function EmptyState({ variant }: EmptyStateProps) {
   const isPage = variant === "page";

   return (
      <div
         className={cn(
            "flex flex-1 flex-col items-center justify-center gap-4",
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
         <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
               Tente o Montte AI para...
            </p>
            <div
               className={cn(
                  "flex flex-wrap justify-center gap-2",
                  isPage && "max-w-2xl",
               )}
            >
               {SCOPE_SUGGESTIONS.map((scope) => {
                  const Icon = scope.icon;
                  return (
                     <Button
                        className="h-7 gap-2 rounded-full px-2 text-xs font-normal"
                        key={scope.id}
                        onClick={() => selectScope(scope.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                     >
                        <Icon className="size-4" />
                        {scope.label}
                     </Button>
                  );
               })}
            </div>
         </div>
      </div>
   );
}
