import { Button } from "@packages/ui/components/button";
import { ArrowRight, CirclePlay } from "lucide-react";

export function HeroCarousel() {
   return (
      <div className="relative w-full py-36">
         <div className="relative z-10 mx-auto w-full max-w-5xl px-2 sm:px-4">
            <div className="flex max-w-xl flex-col gap-4 md:w-1/2">
               <h1 className="max-w-md text-5xl font-medium leading-none text-foreground text-balance md:text-6xl">
                  Recorrência simples para empresas brasileiras
               </h1>
               <p className="max-w-2xl text-xl leading-relaxed text-muted-foreground text-balance">
                  Cobre uso, concilie receita e entenda cada cliente sem
                  remendar planilhas, cobrança e financeiro.
               </p>

               <div className="flex flex-wrap items-center gap-2">
                  <a href="#waitlist" data-ph-cta="hero_waitlist">
                     <Button size="lg" variant="default">
                        Quero acesso antecipado
                        <ArrowRight aria-hidden="true" />
                     </Button>
                  </a>
                  <a href="#operacao">
                     <Button size="lg" variant="outline">
                        <CirclePlay
                           aria-hidden="true"
                           className="fill-primary/25 stroke-primary"
                        />
                        Ver operação
                     </Button>
                  </a>
               </div>
            </div>
         </div>

         <div className="perspective-near pointer-events-none translate-x-4 pt-24 md:absolute md:bottom-16 md:left-1/2 md:right-[-6rem] md:top-40 md:translate-x-0 md:pt-0">
            <div className="before:absolute before:inset-x-[-1rem] before:bottom-4 before:top-0 before:skew-x-6 before:rounded-[2rem] before:border before:border-foreground/5 before:bg-foreground/5 relative h-full">
               <div className="relative h-full min-h-[540px] -translate-y-12 skew-x-6 overflow-hidden rounded-2xl border border-border/70 bg-[#f8f7f4] shadow-2xl shadow-background/70 ring-1 ring-foreground/5">
                  <ProductScreen />
               </div>
            </div>
         </div>
      </div>
   );
}

function ProductScreen() {
   return (
      <div className="flex h-full min-h-[540px] bg-[#f8f7f4] text-left text-[#1d1b20]">
         <aside className="hidden w-52 shrink-0 flex-col justify-between border-r border-[#dedbd5] bg-[#f1efea]/90 p-4 sm:flex">
            <div className="flex flex-col gap-4">
               <div className="flex items-center justify-between gap-4">
                  <img src="/mascot.svg" alt="" className="size-4" />
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
               <div className="flex min-h-[380px] flex-col gap-4 rounded-2xl border border-[#dedbd5] bg-white/70 p-4">
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

               <div className="hidden min-h-[380px] flex-col gap-4 rounded-2xl border border-[#dedbd5] bg-[#f1efea] p-4 lg:flex">
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
