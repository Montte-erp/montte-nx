import type { ReactNode } from "react";

export function HeroCarousel() {
   return (
      <div className="grid w-full gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
         <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
            <p className="inline-flex rounded-full border border-border/70 bg-secondary/50 px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
               Billing, uso e financeiro para SaaS brasileiros
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-none text-foreground text-balance sm:text-4xl md:text-5xl lg:text-6xl">
               Recorrência sem remendar billing, ERP e planilha.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
               Modele planos, acompanhe uso, gere cobranças e feche o financeiro
               por cliente em uma única operação.
            </p>

            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
               <Badge>customers.state</Badge>
               <Badge>uso medido</Badge>
               <Badge>cobrança</Badge>
               <Badge>caixa</Badge>
               <Badge>inadimplência</Badge>
            </div>
         </div>

         <RecurringConsole />
      </div>
   );
}

function Badge({ children }: { children: ReactNode }) {
   return (
      <span className="rounded-full border border-border/70 bg-background/70 px-2 py-2 text-xs text-muted-foreground">
         {children}
      </span>
   );
}

function RecurringConsole() {
   return (
      <figure className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-background/70">
         <header className="flex items-center gap-4 border-b border-border/60 bg-secondary/30 px-4 py-2">
            <div className="flex items-center gap-2">
               <span className="size-2 rounded-full bg-destructive/60" />
               <span className="size-2 rounded-full bg-chart-3/60" />
               <span className="size-2 rounded-full bg-primary/60" />
            </div>
            <code className="flex-1 truncate rounded-md bg-background/60 px-2 py-2 text-xs text-muted-foreground">
               app.montte.co/acme/recurrence
            </code>
            <div className="hidden items-center gap-2 sm:flex">
               <Badge>SaaS BR</Badge>
               <Badge>Maio 2026</Badge>
            </div>
         </header>

         <div className="grid gap-4 p-4 lg:grid-cols-[1fr_0.9fr]">
            <section className="flex flex-col gap-4">
               <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     Customer state
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                     <div>
                        <p className="text-xl font-semibold text-foreground">
                           Acme
                        </p>
                        <p className="text-sm text-muted-foreground">
                           Growth · uso medido
                        </p>
                     </div>
                     <span className="rounded-full bg-primary/15 px-2 py-2 text-xs font-semibold text-primary">
                        Ativo
                     </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                     <Status label="Assinatura" value="Growth" />
                     <Status label="Uso" value="+14%" />
                     <Status label="Fatura" value="Aberta" />
                  </div>
               </div>

               <div className="grid gap-4 sm:grid-cols-2">
                  <Panel title="Uso e cobrança">
                     <Meter
                        label="AI events"
                        value="18.420"
                        detail="R$ 0,058 por evento"
                     />
                     <Meter
                        label="NFS-e"
                        value="108"
                        detail="R$ 2,00 por nota"
                     />
                     <Meter
                        label="E-mails"
                        value="1.420"
                        detail="R$ 0,02 por envio"
                     />
                  </Panel>

                  <Panel title="Financeiro">
                     <Row label="Receita reconhecida" value="R$ 1.284,00" />
                     <Row label="Centro de Custo" value="Produto" />
                     <Row label="Próxima ação" value="Revisar cobrança" />
                  </Panel>
               </div>
            </section>

            <aside className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/80 p-4">
               <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     billing.ts
                  </p>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-2 text-xs text-primary">
                     92ms
                  </span>
               </div>

               <pre className="overflow-hidden rounded-lg border border-border/70 bg-card p-4 text-xs leading-relaxed text-muted-foreground">
                  <code>{`const state = await montte.customers.state({
  customerId: "cus_acme",
});

if (state.usage.overage) {
  await montte.billing.invoice({
    customerId: state.customer.id,
    meter: "ai_events",
  });
}`}</code>
               </pre>

               <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     Resultado
                  </p>
                  <Row label="Cobrança gerada" value="R$ 1.068,36" />
                  <Row label="Risco" value="Uso acima da cota" />
                  <Row label="Financeiro" value="Conciliar receita" />
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

function Meter({
   label,
   value,
   detail,
}: {
   label: string;
   value: string;
   detail: string;
}) {
   return (
      <div className="flex items-center justify-between gap-4 border-t border-border/40 py-2">
         <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
         </div>
         <p className="text-sm font-semibold tabular-nums text-foreground">
            {value}
         </p>
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
