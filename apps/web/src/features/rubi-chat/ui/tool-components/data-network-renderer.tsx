import type { RubiToolProps } from "@/features/rubi-chat/ui/thread";
import { cn } from "@packages/ui/lib/utils";
import { CheckIcon, LoaderIcon } from "lucide-react";
import type { FC } from "react";
import { memo } from "react";
import { getToolDisplay } from "./tool-display-config";

interface NetworkStep {
   id: string;
   name: string;
   status: "running" | "done";
}

interface NetworkData {
   steps?: NetworkStep[];
}

const DataNetworkRendererImpl: FC<RubiToolProps> = ({ result }) => {
   const data = result as NetworkData | undefined;
   const steps = data?.steps;
   if (!steps || steps.length === 0) return null;

   return (
      <div className="flex flex-col gap-0.5 py-0.5">
         {steps.map((step) => {
            const config = getToolDisplay(step.name);
            const Icon = config?.icon;
            const label = config?.label ?? step.name;
            const isRunning = step.status === "running";

            return (
               <div
                  className="flex items-center gap-2 py-0.5 text-sm"
                  key={step.id}
               >
                  {isRunning ? (
                     <LoaderIcon className="size-3 shrink-0 animate-spin text-primary" />
                  ) : (
                     <CheckIcon className="size-3 shrink-0 text-muted-foreground/50" />
                  )}
                  {Icon && (
                     <div
                        className={cn(
                           "flex size-4 shrink-0 items-center justify-center rounded-sm",
                           isRunning
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                        )}
                     >
                        <Icon className="size-2.5" />
                     </div>
                  )}
                  <span
                     className={cn(
                        "text-muted-foreground",
                        isRunning && "text-foreground",
                     )}
                  >
                     {label}
                  </span>
               </div>
            );
         })}
      </div>
   );
};

export const DataNetworkRenderer = memo(DataNetworkRendererImpl);
DataNetworkRenderer.displayName = "DataNetworkRenderer";
