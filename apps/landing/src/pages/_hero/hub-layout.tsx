import { Button } from "@packages/ui/components/button";
import {
   CreditCard,
   FileSpreadsheet,
   Lightbulb,
   Receipt,
   Users,
   Wallet,
   Wand2,
   Workflow,
   Zap,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type HubPosition =
   | "left-top"
   | "left-middle"
   | "left-bottom"
   | "right-top"
   | "right-middle"
   | "right-bottom";

function HubCard({
   icon: Icon,
   tone,
   position,
   isCenter = false,
}: {
   icon: Icon;
   tone?: string;
   position?: HubPosition;
   isCenter?: boolean;
}) {
   const sizeClass = isCenter
      ? "size-16 border-border shadow-xl"
      : "size-12 border-border";
   const iconSize = isCenter ? "size-8" : "size-6";
   return (
      <div
         className={`relative flex rounded-xl border bg-background ${sizeClass}`}
      >
         <div className="z-20 flex flex-1 items-center justify-center">
            <Icon aria-hidden="true" className={`${iconSize} ${tone ?? ""}`} />
         </div>
         {position && !isCenter ? (
            <div
               className={`absolute top-1/2 z-10 h-px bg-gradient-to-r to-muted-foreground/25 ${
                  position === "left-top"
                     ? "left-full w-[130px] origin-left rotate-[25deg]"
                     : position === "left-middle"
                       ? "left-full w-[120px] origin-left"
                       : position === "left-bottom"
                         ? "left-full w-[130px] origin-left rotate-[-25deg]"
                         : position === "right-top"
                           ? "right-full w-[130px] origin-right rotate-[-25deg] bg-gradient-to-l"
                           : position === "right-middle"
                             ? "right-full w-[120px] origin-right bg-gradient-to-l"
                             : "right-full w-[130px] origin-right rotate-[25deg] bg-gradient-to-l"
               }`}
            />
         ) : null}
      </div>
   );
}

export function HubLayout() {
   return (
      <div className="flex flex-col items-center gap-4">
         <div className="relative flex w-full max-w-sm items-center justify-between">
            <div className="flex flex-col gap-4">
               <HubCard icon={Wallet} tone="text-primary" position="left-top" />
               <HubCard
                  icon={Users}
                  tone="text-chart-2"
                  position="left-middle"
               />
               <HubCard
                  icon={Workflow}
                  tone="text-chart-3"
                  position="left-bottom"
               />
            </div>

            <div
               aria-hidden="true"
               className="absolute inset-1/4 bg-[radial-gradient(var(--dots-color)_1px,transparent_1px)] opacity-50 [--dots-color:white] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"
            />

            <div className="relative z-20 rounded-2xl border border-border bg-muted p-2">
               <div className="flex size-16 items-center justify-center rounded-xl border border-border bg-background shadow-xl">
                  <img className="size-8" src="/favicon.svg" alt="" />
               </div>
            </div>

            <div className="flex flex-col gap-4">
               <HubCard
                  icon={Receipt}
                  tone="text-chart-5"
                  position="right-top"
               />
               <HubCard
                  icon={CreditCard}
                  tone="text-chart-6"
                  position="right-middle"
               />
               <HubCard
                  icon={FileSpreadsheet}
                  tone="text-foreground"
                  position="right-bottom"
               />
            </div>
         </div>

         <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="sm" variant="outline" type="button">
               <Lightbulb aria-hidden="true" />
               Aprender
            </Button>
            <Button size="sm" variant="outline" type="button">
               <Wand2 aria-hidden="true" />
               Operar
            </Button>
            <Button size="sm" variant="outline" type="button">
               <Zap aria-hidden="true" />
               Analisar
            </Button>
         </div>
      </div>
   );
}
