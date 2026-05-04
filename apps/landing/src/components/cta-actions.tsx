import { Button } from "@packages/ui/components/button";
import { ArrowRight } from "lucide-react";

export function CtaActions() {
   return (
      <div className="flex flex-col gap-2 sm:flex-row">
         <Button size="lg" className="group rounded-full px-4">
            Comecar agora
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
         </Button>
         <Button size="lg" variant="outline" className="rounded-full px-4">
            Ver demonstracao
         </Button>
      </div>
   );
}
