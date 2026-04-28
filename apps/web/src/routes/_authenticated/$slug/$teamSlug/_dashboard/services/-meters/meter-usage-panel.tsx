import { Badge } from "@packages/ui/components/badge";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Gauge, Gift, Tag, Wallet } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";

interface MeterUsagePanelProps {
   meterId: string;
   meterName: string;
}

export function MeterUsagePanel(props: MeterUsagePanelProps) {
   return (
      <>
         <CredenzaHeader className="pb-3">
            <CredenzaTitle className="text-base">
               {props.meterName}
            </CredenzaTitle>
            <CredenzaDescription>
               Onde este medidor é usado.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="overflow-y-auto max-h-[60vh]">
            <QueryBoundary
               errorTitle="Erro ao carregar uso do medidor"
               fallback={<UsageSkeleton />}
            >
               <UsageContent meterId={props.meterId} />
            </QueryBoundary>
         </CredenzaBody>
      </>
   );
}

function UsageSkeleton() {
   return (
      <div className="flex flex-col gap-4 py-4">
         <div className="h-20 rounded bg-muted/40 animate-pulse" />
         <div className="h-20 rounded bg-muted/40 animate-pulse" />
         <div className="h-20 rounded bg-muted/40 animate-pulse" />
      </div>
   );
}

function UsageContent({ meterId }: { meterId: string }) {
   const { data } = useSuspenseQuery(
      orpc.meters.getMeterUsage.queryOptions({ input: { id: meterId } }),
   );

   const total =
      data.prices.length + data.benefits.length + data.coupons.length;

   if (total === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Gauge className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhum vínculo</EmptyTitle>
               <EmptyDescription>
                  Este medidor ainda não é referenciado por preços, benefícios
                  ou cupons.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <div className="flex flex-col gap-6 py-2">
         <Section
            icon={<Wallet className="size-4" />}
            title="Preços de serviço"
            count={data.prices.length}
         >
            {data.prices.map((p) => (
               <div
                  key={p.priceId}
                  className="flex items-center justify-between rounded border p-3"
               >
                  <div className="flex flex-col gap-1">
                     <span className="text-sm font-medium">
                        {p.serviceName}
                     </span>
                     <span className="text-xs text-muted-foreground">
                        {p.priceName} · {p.interval}
                     </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="tabular-nums text-sm">
                        R$ {p.basePrice}
                     </span>
                     {!p.isActive ? (
                        <Badge variant="outline">Pausado</Badge>
                     ) : null}
                  </div>
               </div>
            ))}
         </Section>

         <Section
            icon={<Gift className="size-4" />}
            title="Benefícios"
            count={data.benefits.length}
         >
            {data.benefits.map((b) => (
               <div
                  key={b.id}
                  className="flex items-center justify-between rounded border p-3"
               >
                  <div className="flex flex-col gap-1">
                     <span className="text-sm font-medium">{b.name}</span>
                     <span className="text-xs text-muted-foreground">
                        {b.type}
                        {b.creditAmount != null
                           ? ` · ${b.creditAmount} créditos`
                           : " · ilimitado"}
                     </span>
                  </div>
                  {!b.isActive ? (
                     <Badge variant="outline">Pausado</Badge>
                  ) : null}
               </div>
            ))}
         </Section>

         <Section
            icon={<Tag className="size-4" />}
            title="Cupons"
            count={data.coupons.length}
         >
            {data.coupons.map((c) => (
               <div
                  key={c.id}
                  className="flex items-center justify-between rounded border p-3"
               >
                  <div className="flex flex-col gap-1">
                     <span className="text-sm font-medium">{c.code}</span>
                     <span className="text-xs text-muted-foreground">
                        {c.direction === "surcharge" ? "Acréscimo" : "Desconto"}{" "}
                        ·{" "}
                        {c.type === "percent"
                           ? `${c.amount}%`
                           : `R$ ${c.amount}`}{" "}
                        · {c.trigger === "auto" ? "automático" : "código"}
                     </span>
                  </div>
                  {!c.isActive ? (
                     <Badge variant="outline">Pausado</Badge>
                  ) : null}
               </div>
            ))}
         </Section>
      </div>
   );
}

interface SectionProps {
   icon: React.ReactNode;
   title: string;
   count: number;
   children: React.ReactNode;
}

function Section(props: SectionProps) {
   if (props.count === 0) return null;
   return (
      <section className="flex flex-col gap-3">
         <header className="inline-flex items-center gap-2 text-sm font-semibold">
            {props.icon}
            <span>{props.title}</span>
            <span className="text-muted-foreground">· {props.count}</span>
         </header>
         <div className="flex flex-col gap-2">{props.children}</div>
      </section>
   );
}
