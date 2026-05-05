import {
   ArrowDownToLine,
   CreditCard,
   Gauge,
   Receipt,
   Sparkles,
   Ticket,
} from "lucide-react";

function MeterBar({
   label,
   value,
   limit,
   unit,
   percent,
   tone,
   bg,
}: {
   label: string;
   value: string;
   limit: string;
   unit: string;
   percent: number;
   tone: string;
   bg: string;
}) {
   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-foreground">{label}</span>
            <span className="text-muted-foreground">
               <span className={tone}>{value}</span> / {limit} {unit}
            </span>
         </div>
         <div className="h-2 overflow-hidden rounded-full bg-muted">
            <span
               className={`block h-full rounded-full ${bg}`}
               style={{ width: `${percent}%` }}
            />
         </div>
      </div>
   );
}

function InvoiceLine({
   label,
   detail,
   value,
}: {
   label: string;
   detail: string;
   value: string;
}) {
   return (
      <li className="flex items-center justify-between gap-4 border-b border-dashed border-border/60 py-2 text-sm">
         <div className="flex flex-col">
            <span className="font-bold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
         </div>
         <span className="font-bold text-foreground">{value}</span>
      </li>
   );
}

export function BillingLayout() {
   return (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
         <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between">
               <span className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Gauge aria-hidden="true" className="size-4 text-primary" />
                  Uso · ciclo de outubro
               </span>
               <span className="text-xs font-bold text-muted-foreground">
                  18 dias restantes
               </span>
            </div>

            <div className="flex flex-col gap-4">
               <MeterBar
                  label="Cobranças emitidas"
                  value="1.842"
                  limit="3.000"
                  unit="op"
                  percent={61}
                  tone="text-primary"
                  bg="bg-primary"
               />
               <MeterBar
                  label="Mensagens da Montte AI"
                  value="9.420"
                  limit="15.000"
                  unit="msg"
                  percent={63}
                  tone="text-chart-6"
                  bg="bg-chart-6"
               />
               <MeterBar
                  label="Notas e recibos"
                  value="312"
                  limit="500"
                  unit="docs"
                  percent={62}
                  tone="text-chart-3"
                  bg="bg-chart-3"
               />
               <MeterBar
                  label="Pix e boletos"
                  value="754"
                  limit="2.000"
                  unit="op"
                  percent={38}
                  tone="text-chart-2"
                  bg="bg-chart-2"
               />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs font-bold text-muted-foreground">
               <span className="inline-flex items-center gap-2">
                  <Sparkles
                     aria-hidden="true"
                     className="size-3 text-chart-3"
                  />
                  Add-on contratado · +500 docs
               </span>
               <span className="inline-flex items-center gap-2">
                  <Ticket aria-hidden="true" className="size-3 text-chart-5" />
                  Cupom LANÇAMENTO · -15%
               </span>
            </div>
         </div>

         <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between">
               <span className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Receipt aria-hidden="true" className="size-4 text-chart-5" />
                  Próxima fatura
               </span>
               <span className="text-xs font-bold text-muted-foreground">
                  31/10
               </span>
            </div>

            <ul className="flex list-none flex-col p-0">
               <InvoiceLine
                  label="Plataforma"
                  detail="assinatura mensal"
                  value="R$ 199,00"
               />
               <InvoiceLine
                  label="Cobranças emitidas"
                  detail="1.842 op · R$ 0,12"
                  value="R$ 221,04"
               />
               <InvoiceLine
                  label="Montte AI · mensagens"
                  detail="9.420 msg · R$ 0,008"
                  value="R$ 75,36"
               />
               <InvoiceLine
                  label="Add-on · +500 docs"
                  detail="pacote único"
                  value="R$ 49,00"
               />
               <InvoiceLine
                  label="Cupom LANÇAMENTO"
                  detail="-15% sobre o subtotal"
                  value="−R$ 81,66"
               />
            </ul>

            <div className="flex items-center justify-between rounded-md bg-muted/60 px-4 py-2">
               <span className="text-sm font-bold text-foreground">Total</span>
               <span className="text-2xl font-black tracking-[-0.03em] text-foreground">
                  R$ 462,74
               </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
               <span className="inline-flex items-center gap-2">
                  <CreditCard
                     aria-hidden="true"
                     className="size-3 text-chart-2"
                  />
                  Abacate Pay
               </span>
               <span className="inline-flex items-center gap-2">
                  <ArrowDownToLine
                     aria-hidden="true"
                     className="size-3 text-foreground"
                  />
                  Exportação contábil
               </span>
            </div>
         </div>
      </div>
   );
}
