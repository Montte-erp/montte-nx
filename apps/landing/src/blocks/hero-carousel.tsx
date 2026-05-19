import type { ReactNode } from "react";

export function HeroCarousel() {
   return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 text-center">
         <div className="flex max-w-3xl flex-col items-center gap-4">
            <p className="inline-flex rounded-full border border-border/70 bg-secondary/50 px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
               Recorrência para empresas brasileiras
            </p>
            <h1 className="text-3xl font-semibold leading-none text-foreground text-balance sm:text-4xl md:text-5xl lg:text-6xl">
               Cobre, concilie e acompanhe clientes em um só lugar.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
               O Montte transforma contrato, uso e faturas em uma visão simples
               do que aconteceu e do que precisa ser feito agora.
            </p>
         </div>

         <RecurringConsole />
      </div>
   );
}

function RecurringConsole() {
   return (
      <figure className="w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-background/70">
         <header className="flex items-center justify-between gap-4 border-b border-border/60 bg-secondary/30 px-4 py-2">
            <div className="flex items-center gap-2">
               <span className="size-2 rounded-full bg-destructive/60" />
               <span className="size-2 rounded-full bg-chart-3/60" />
               <span className="size-2 rounded-full bg-primary/60" />
            </div>
            <p className="truncate text-xs font-medium text-muted-foreground">
               Operação de recorrência · Maio
            </p>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-2 text-xs text-primary">
               Em dia
            </span>
         </header>

         <div className="grid gap-4 p-4 lg:grid-cols-[1fr_0.8fr]">
            <section className="flex flex-col gap-4">
               <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/70 p-4 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                     <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                           Estado do cliente
                        </p>
                        <p className="text-2xl font-semibold text-foreground">
                           Acme
                        </p>
                        <p className="text-sm text-muted-foreground">
                           Plano Crescimento · uso medido
                        </p>
                     </div>
                     <span className="rounded-full bg-primary/15 px-2 py-2 text-xs font-semibold text-primary">
                        Ativo
                     </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                     <Status label="Uso" value="+14%" />
                     <Status label="Fatura" value="Aberta" />
                     <Status label="Risco" value="Médio" />
                  </div>
               </div>

               <div className="grid gap-4 sm:grid-cols-2">
                  <Panel title="Cobrança">
                     <Row label="Uso do mês" value="18.420 eventos" />
                     <Row label="Excedente" value="14% acima" />
                     <Row label="Valor previsto" value="R$ 1.068,36" />
                  </Panel>

                  <Panel title="Financeiro">
                     <Row label="Receita" value="R$ 1.284,00" />
                     <Row label="Centro de Custo" value="Produto" />
                     <Row label="Próxima ação" value="Revisar" />
                  </Panel>
               </div>
            </section>

            <aside className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/80 p-4 text-left">
               <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     Ação recomendada
                  </p>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-2 text-xs text-primary">
                     92 ms
                  </span>
               </div>

               <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">
                     Gerar cobrança incremental
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                     O cliente passou da cota contratada. O Montte conferiu
                     contrato, uso e fatura antes de sugerir a cobrança.
                  </p>
               </div>

               <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-4">
                  <Row label="Contrato" value="Incremental" />
                  <Row label="Cobrança" value="R$ 1.068,36" />
                  <Row label="Caixa" value="A conciliar" />
               </div>
            </aside>
         </div>
      </figure>
   );
}

function Status({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-lg border border-border/60 bg-card p-4">
         <p className="text-xs text-muted-foreground">{label}</p>
         <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
   );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
   return (
      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/70 p-4">
         <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {title}
         </p>
         <div className="flex flex-col gap-2">{children}</div>
      </div>
   );
}

function Row({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-center justify-between gap-4 border-t border-border/40 py-2 text-sm">
         <span className="text-muted-foreground">{label}</span>
         <span className="font-medium text-foreground">{value}</span>
      </div>
   );
}
