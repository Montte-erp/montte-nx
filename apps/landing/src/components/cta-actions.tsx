import { Button } from "@packages/ui/components/button";
import { Sparkles } from "lucide-react";

export function CtaActions() {
   return (
      <div className="flex flex-col gap-2 sm:flex-row">
         <Button size="lg" className="rounded-full px-4">
            Começar agora — é grátis
         </Button>
         <Button
            size="lg"
            variant="outline"
            className="group rounded-full px-4"
         >
            Instalar com IA
            <Sparkles className="size-4 text-primary transition-transform group-hover:rotate-12" />
         </Button>
      </div>
   );
}
