import { Button } from "@packages/ui/components/button";
import { ArrowRight, CirclePlay } from "lucide-react";

export function HeroCarousel() {
   return (
      <div className="relative w-full py-[6rem]">
         <div className="relative z-10 mx-auto w-full max-w-5xl px-2 sm:px-4">
            <div className="flex max-w-xl flex-col gap-4 md:w-1/2">
               <h1 className="text-5xl font-medium leading-none text-foreground text-balance md:text-6xl">
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

         <div className="perspective-near pointer-events-none translate-x-4 pt-[4rem] md:absolute md:bottom-4 md:left-1/2 md:right-[-2rem] md:top-4 md:translate-x-0 md:pt-0">
            <div className="before:absolute before:inset-x-[-1rem] before:bottom-4 before:top-0 before:skew-x-6 before:rounded-[2rem] before:border before:border-foreground/5 before:bg-foreground/5 relative h-full">
               <div className="relative h-full min-h-[420px] -translate-y-4 skew-x-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-background/70 ring-1 ring-foreground/5">
                  <ProductScreen />
               </div>
            </div>
         </div>
      </div>
   );
}

function ProductScreen() {
   return (
      <div className="flex h-full min-h-[420px] bg-background text-left">
         <aside className="hidden w-48 shrink-0 flex-col justify-between border-r border-border/70 bg-secondary/40 p-4 sm:flex">
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-2">
                  <img src="/mascot.svg" alt="" className="size-4" />
                  <span className="text-sm font-semibold text-foreground">
                     Montte
                  </span>
               </div>
               <nav className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-primary px-2 py-2 font-medium text-primary-foreground">
                     Recorrência
                  </span>
                  <span className="px-2 py-2">Clientes</span>
                  <span className="px-2 py-2">Contratos</span>
                  <span className="px-2 py-2">Cobranças</span>
                  <span className="px-2 py-2">Financeiro</span>
               </nav>
            </div>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
               <span>Configurações</span>
               <span>Ajuda</span>
            </div>
         </aside>

         <main className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 pb-4">
               <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                     Operação de maio
                  </p>
                  <h2 className="text-2xl font-semibold text-foreground">
                     Clientes com ação pendente
                  </h2>
               </div>
               <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-2 text-xs font-medium text-primary">
                  12 ações
               </span>
            </header>

            <section className="grid gap-4 lg:grid-cols-3">
               <Metric label="Uso acima da cota" value="8" />
               <Metric label="Faturas abertas" value="14" />
               <Metric label="Receita a conciliar" value="R$ 42 mil" />
            </section>

            <section className="grid flex-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
               <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                     Próximas ações
                  </p>
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

               <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                     Resumo Acme
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                     O cliente ultrapassou a cota contratada em 14%. A cobrança
                     incremental está disponível para revisão financeira.
                  </p>
                  <div className="grid gap-2 pt-4 text-sm">
                     <Item label="Uso" value="18.420 eventos" />
                     <Item label="Cobrança" value="R$ 1.068,36" />
                     <Item label="Caixa" value="A conciliar" />
                  </div>
               </div>
            </section>
         </main>
      </div>
   );
}

function Metric({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-xl border border-border/70 bg-card p-4">
         <p className="text-xs text-muted-foreground">{label}</p>
         <p className="text-2xl font-semibold text-foreground">{value}</p>
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
      <div className="grid grid-cols-[0.8fr_0.9fr_1fr] gap-2 border-t border-border/50 py-2 text-sm">
         <span className="font-medium text-foreground">{cliente}</span>
         <span className="text-muted-foreground">{estado}</span>
         <span className="text-primary">{acao}</span>
      </div>
   );
}

function Item({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-center justify-between gap-4 border-t border-border/50 py-2">
         <span className="text-muted-foreground">{label}</span>
         <span className="font-medium text-foreground">{value}</span>
      </div>
   );
}
