import { Button } from "@packages/ui/components/button";
import { ChevronRight } from "lucide-react";

export function HeroCarousel() {
   return (
      <main className="w-full overflow-hidden">
         <section className="bg-transparent">
            <div className="relative py-36">
               <div className="relative z-10 mx-auto w-full max-w-5xl px-6">
                  <div className="md:w-1/2">
                     <div>
                        <h1 className="max-w-md text-5xl font-medium text-balance md:text-6xl">
                           Infraestrutura AI-native para serviços recorrentes
                        </h1>
                        <p className="my-8 max-w-2xl text-xl text-muted-foreground text-balance">
                           O Montte junta cobrança, clientes, uso, pendências e
                           financeiro em uma infraestrutura fácil de
                           implementar. Feito para SaaS, coworkings e empresas
                           que vivem de recorrência.
                        </p>

                        <div className="flex items-center gap-3">
                           <Button asChild size="lg" className="pr-4">
                              <a href="#waitlist" data-ph-cta="hero_waitlist">
                                 <span className="text-nowrap">
                                    Quero acesso antecipado
                                 </span>
                                 <ChevronRight className="opacity-50" />
                              </a>
                           </Button>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="perspective-near translate-x-12 pt-24 md:absolute md:-right-6 md:bottom-16 md:left-1/2 md:top-40 md:translate-x-0 md:pt-0">
                  <div className="before:absolute before:-inset-x-4 before:bottom-7 before:top-0 before:skew-x-6 before:rounded-[calc(var(--radius)+1rem)] before:border before:border-foreground/5 before:bg-foreground/5 relative h-full">
                     <div className="relative h-full min-h-[520px] -translate-y-12 skew-x-6 overflow-hidden rounded-[var(--radius)] border border-transparent bg-[#101827] shadow-md shadow-foreground/10 ring-1 ring-foreground/5 md:min-h-0">
                        <ProductScreen />
                     </div>
                  </div>
               </div>
            </div>
         </section>
      </main>
   );
}

function ProductScreen() {
   return (
      <img
         src="/illustrations/hero-dashboard.webp"
         alt="Tela de lançamentos financeiros no Montte"
         width={1870}
         height={992}
         className="size-full object-cover object-left-top"
         loading="eager"
      />
   );
}
