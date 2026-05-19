import { Button } from "@packages/ui/components/button";
import { ArrowRight } from "lucide-react";

export function HeroCarousel() {
   return (
      <div className="grid w-full gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
         <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
            <p className="inline-flex rounded-full border border-border/70 bg-secondary/50 px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
               Recorrência para empresas brasileiras
            </p>
            <h1 className="max-w-2xl text-3xl font-semibold leading-none text-foreground text-balance sm:text-4xl md:text-5xl lg:text-6xl">
               Cobre uso, concilie receita e entenda cada cliente.
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
               O Montte conecta contrato, consumo, faturas e caixa para mostrar
               o que aconteceu e qual ação vem depois.
            </p>
            <a href="#waitlist" data-ph-cta="hero_waitlist">
               <Button size="lg" variant="default">
                  Quero acesso antecipado
                  <ArrowRight aria-hidden="true" />
               </Button>
            </a>
         </div>

         <figure className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-secondary/30 p-2 shadow-2xl shadow-background/70">
            <img
               src="/illustrations/hero-right.png"
               alt="Mascote do Montte acompanhando a operação recorrente"
               className="aspect-[4/3] w-full rounded-[1.5rem] object-cover"
            />
         </figure>
      </div>
   );
}
