import { Button } from "@packages/ui/components/button";
import { ChevronRight, CirclePlay } from "lucide-react";

export function HeroCarousel() {
   return (
      <main className="w-full overflow-hidden">
         <section className="bg-linear-to-b from-background to-muted">
            <div className="relative py-36">
               <div className="relative z-10 mx-auto w-full max-w-5xl px-6">
                  <div className="md:w-1/2">
                     <div>
                        <h1 className="max-w-md text-5xl font-medium text-balance md:text-6xl">
                           Recorrência simples para empresas brasileiras
                        </h1>
                        <p className="my-8 max-w-2xl text-xl text-muted-foreground text-balance">
                           Cobre uso, concilie receita e entenda cada cliente
                           sem remendar planilhas, cobrança e financeiro.
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
                           <Button
                              key={2}
                              asChild
                              size="lg"
                              variant="outline"
                              className="pl-4"
                           >
                              <a href="#operacao">
                                 <CirclePlay className="fill-primary/25 stroke-primary" />
                                 <span className="text-nowrap">
                                    Ver operação
                                 </span>
                              </a>
                           </Button>
                        </div>
                     </div>

                     <div className="pt-10">
                        <p className="text-muted-foreground">
                           Feito para times de:
                        </p>
                        <div className="flex items-center gap-8 pt-6 text-sm font-semibold text-foreground">
                           <span>Financeiro</span>
                           <span>Operações</span>
                           <span>Receita</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="perspective-near translate-x-12 pt-24 md:absolute md:-right-6 md:bottom-16 md:left-1/2 md:top-40 md:translate-x-0 md:pt-0">
                  <div className="before:absolute before:-inset-x-4 before:bottom-7 before:top-0 before:skew-x-6 before:rounded-[calc(var(--radius)+1rem)] before:border before:border-foreground/5 before:bg-foreground/5 relative h-full">
                     <div className="relative h-full min-h-[520px] -translate-y-12 skew-x-6 overflow-hidden rounded-[var(--radius)] border border-transparent bg-background shadow-md shadow-foreground/10 ring-1 ring-foreground/5 md:min-h-0">
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
      <div className="flex h-full min-h-[520px] bg-[#f8f7f4] text-left text-[#1d1b20] md:min-h-0">
         <aside className="hidden w-52 shrink-0 flex-col justify-between border-r border-[#dedbd5] bg-[#f1efea]/90 p-4 sm:flex">
            <div className="flex flex-col gap-4">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                     <img src="/mascot.svg" alt="" className="size-4" />
                     <span className="text-sm font-semibold">Montte</span>
                  </div>
                  <span className="rounded-md border border-[#dedbd5] bg-white/70 px-2 py-2 text-xs text-[#69645c]">
                     Novo
                  </span>
               </div>

               <nav className="flex flex-col gap-2 text-xs text-[#69645c]">
                  <span className="rounded-md bg-[#1d1b20] px-2 py-2 font-medium text-white">
                     Cobrança rápida
                  </span>
                  <span className="px-2 py-2">Painel</span>
                  <span className="px-2 py-2">Ciclo de vida</span>
                  <span className="px-2 py-2">Contratos</span>
                  <span className="px-2 py-2">Clientes</span>
               </nav>

               <div className="flex flex-col gap-2 pt-4 text-xs text-[#69645c]">
                  <span className="px-2 py-2">Documentos</span>
                  <span className="px-2 py-2">Relatórios</span>
                  <span className="px-2 py-2">Assistente</span>
                  <span className="px-2 py-2">Mais</span>
               </div>
            </div>

            <div className="flex flex-col gap-2 text-xs text-[#69645c]">
               <span className="px-2 py-2">Configurações</span>
               <span className="px-2 py-2">Ajuda</span>
               <span className="px-2 py-2">Buscar</span>
            </div>
         </aside>

         <main className="flex min-w-0 flex-1 flex-col gap-4 bg-[#fbfaf7]">
            <header className="flex items-center justify-between gap-4 border-b border-[#dedbd5] px-4 py-4">
               <div className="flex items-center gap-4">
                  <span className="text-sm text-[#69645c]">Operação</span>
                  <span className="text-sm font-medium text-[#1d1b20]">
                     Recorrência
                  </span>
               </div>
               <span className="rounded-full bg-[#ebe8e2] px-2 py-2 text-xs text-[#69645c]">
                  Montte
               </span>
            </header>

            <section className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_0.8fr]">
               <div className="flex min-h-[360px] flex-col gap-4 rounded-2xl border border-[#dedbd5] bg-white/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                     <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-[0.08em] text-[#69645c]">
                           Receita recorrente
                        </p>
                        <h2 className="text-2xl font-semibold text-[#1d1b20]">
                           Maio em acompanhamento
                        </h2>
                     </div>
                     <span className="rounded-full bg-[#e5f4dc] px-2 py-2 text-xs font-medium text-[#2f6d36]">
                        saudável
                     </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                     <Metric label="Uso medido" value="18.420" />
                     <Metric label="A cobrar" value="R$ 42 mil" />
                     <Metric label="Ações" value="12" />
                  </div>

                  <div className="flex flex-1 flex-col justify-end gap-2">
                     <Row
                        cliente="Acme"
                        estado="Uso acima"
                        acao="Gerar cobrança"
                     />
                     <Row
                        cliente="Northwind"
                        estado="Fatura aberta"
                        acao="Revisar"
                     />
                     <Row
                        cliente="Stark"
                        estado="Pagamento falhou"
                        acao="Cobrar"
                     />
                  </div>
               </div>

               <div className="hidden min-h-[360px] flex-col gap-4 rounded-2xl border border-[#dedbd5] bg-[#f1efea] p-4 lg:flex">
                  <p className="text-sm font-semibold text-[#1d1b20]">
                     Contexto do cliente
                  </p>
                  <div className="grid gap-2 text-sm">
                     <Item label="Contrato" value="Plano Pro" />
                     <Item label="Consumo" value="14% acima" />
                     <Item label="Caixa" value="A conciliar" />
                     <Item label="Próxima ação" value="Cobrar excedente" />
                  </div>
               </div>
            </section>
         </main>
      </div>
   );
}

function Metric({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-xl border border-[#dedbd5] bg-[#fbfaf7] p-4">
         <p className="text-xs text-[#69645c]">{label}</p>
         <p className="text-xl font-semibold text-[#1d1b20]">{value}</p>
      </div>
   );
}

function Row({
   cliente,
   estado,
   acao,
}: {
   cliente: string;
   estado: string;
   acao: string;
}) {
   return (
      <div className="grid grid-cols-[0.8fr_0.9fr_1fr] gap-2 border-t border-[#dedbd5] py-2 text-sm">
         <span className="font-medium text-[#1d1b20]">{cliente}</span>
         <span className="text-[#69645c]">{estado}</span>
         <span className="text-[#2f6d36]">{acao}</span>
      </div>
   );
}

function Item({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-center justify-between gap-4 border-t border-[#dedbd5] py-2">
         <span className="text-[#69645c]">{label}</span>
         <span className="font-medium text-[#1d1b20]">{value}</span>
      </div>
   );
}
