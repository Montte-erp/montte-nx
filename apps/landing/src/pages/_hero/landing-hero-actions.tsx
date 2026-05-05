import { Button } from "@packages/ui/components/button";

export function LandingHeroActions() {
   return (
      <div className="flex flex-wrap items-center gap-2 pt-2">
         <Button asChild size="lg" variant="default">
            <a href="/dashboard">Começar grátis</a>
         </Button>
         <Button asChild size="lg" variant="outline">
            <a href="#contato">Falar com a gente</a>
         </Button>
      </div>
   );
}
