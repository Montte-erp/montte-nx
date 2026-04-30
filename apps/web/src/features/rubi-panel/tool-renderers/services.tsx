import { Badge } from "@packages/ui/components/badge";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";

interface ServiceRow {
   id: string;
   name: string;
   isActive: boolean;
   costPrice?: string | null;
}

interface PriceRow {
   id: string;
   name: string;
   type: string | null;
   interval: string | null;
   basePrice: string;
   meterId?: string | null;
   isActive?: boolean;
}

interface BenefitRow {
   id: string;
   name: string;
   type: string;
   creditAmount?: number | null;
   meterId?: string | null;
}

interface MeterRow {
   id: string;
   name: string;
   eventName: string;
   aggregation: string;
   unitCost: string;
   isActive?: boolean;
}

interface CouponRow {
   id: string;
   code: string;
   scope: string;
   type: string;
   amount: string;
   direction: string;
   duration: string;
   durationMonths: number | null;
   trigger: string;
   isActive: boolean;
   usedCount: number;
   maxUses: number | null;
}

function StatusBadge({ active }: { active: boolean }) {
   return (
      <Badge variant={active ? "default" : "secondary"} className="text-[10px]">
         {active ? "Ativo" : "Inativo"}
      </Badge>
   );
}

export function ServicesListRenderer({
   data,
}: {
   data: { count: number; items: ServiceRow[] };
}) {
   if (data.count === 0)
      return (
         <p className="text-muted-foreground">Nenhum serviço encontrado.</p>
      );
   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead className="text-[11px]">Nome</TableHead>
               <TableHead className="text-[11px]">Status</TableHead>
               <TableHead className="text-[11px]">Custo</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {data.items.map((s) => (
               <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                     <StatusBadge active={s.isActive} />
                  </TableCell>
                  <TableCell>
                     {s.costPrice ? `R$ ${s.costPrice}` : "—"}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

export function ServiceDetailRenderer({
   data,
}: {
   data:
      | { found: false }
      | {
           found: true;
           service: ServiceRow & { description?: string | null };
           prices: PriceRow[];
           benefits: BenefitRow[];
        };
}) {
   if (!data.found)
      return <p className="text-muted-foreground">Serviço não encontrado.</p>;
   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center gap-2">
            <h4 className="font-semibold">{data.service.name}</h4>
            <StatusBadge active={data.service.isActive} />
         </div>
         {data.service.description ? (
            <p className="text-muted-foreground">{data.service.description}</p>
         ) : null}
         <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
               Preços ({data.prices.length})
            </span>
            {data.prices.length === 0 ? (
               <p className="text-muted-foreground">Sem preços.</p>
            ) : (
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead className="text-[11px]">Nome</TableHead>
                        <TableHead className="text-[11px]">Tipo</TableHead>
                        <TableHead className="text-[11px]">Ciclo</TableHead>
                        <TableHead className="text-[11px]">Base</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {data.prices.map((p) => (
                        <TableRow key={p.id}>
                           <TableCell>{p.name}</TableCell>
                           <TableCell>{p.type ?? "—"}</TableCell>
                           <TableCell>{p.interval ?? "—"}</TableCell>
                           <TableCell>R$ {p.basePrice}</TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            )}
         </div>
         <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
               Benefícios ({data.benefits.length})
            </span>
            {data.benefits.length === 0 ? (
               <p className="text-muted-foreground">Nenhum anexado.</p>
            ) : (
               <div className="flex flex-wrap gap-2">
                  {data.benefits.map((b) => (
                     <Badge key={b.id} variant="outline">
                        {b.name}
                        {b.creditAmount ? ` · ${b.creditAmount} créd.` : ""}
                     </Badge>
                  ))}
               </div>
            )}
         </div>
      </div>
   );
}

export function MetersListRenderer({
   data,
}: {
   data: { count: number; items: MeterRow[] };
}) {
   if (data.count === 0)
      return <p className="text-muted-foreground">Nenhum medidor.</p>;
   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead className="text-[11px]">Nome</TableHead>
               <TableHead className="text-[11px]">Evento</TableHead>
               <TableHead className="text-[11px]">Agregação</TableHead>
               <TableHead className="text-[11px]">Custo unit.</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {data.items.map((m) => (
               <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="font-mono text-[10px]">
                     {m.eventName}
                  </TableCell>
                  <TableCell>{m.aggregation}</TableCell>
                  <TableCell>
                     {Number(m.unitCost) > 0 ? `R$ ${m.unitCost}` : "—"}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

export function BenefitsListRenderer({
   data,
}: {
   data: { count: number; items: BenefitRow[] };
}) {
   if (data.count === 0)
      return <p className="text-muted-foreground">Nenhum benefício.</p>;
   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead className="text-[11px]">Nome</TableHead>
               <TableHead className="text-[11px]">Tipo</TableHead>
               <TableHead className="text-[11px]">Créditos</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {data.items.map((b) => (
               <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.type}</TableCell>
                  <TableCell>{b.creditAmount ?? "—"}</TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

export function CouponsListRenderer({
   data,
}: {
   data: { count: number; items: CouponRow[] };
}) {
   if (data.count === 0)
      return <p className="text-muted-foreground">Nenhum cupom.</p>;
   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead className="text-[11px]">Código</TableHead>
               <TableHead className="text-[11px]">Tipo</TableHead>
               <TableHead className="text-[11px]">Valor</TableHead>
               <TableHead className="text-[11px]">Uso</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {data.items.map((c) => (
               <TableRow key={c.id}>
                  <TableCell className="font-mono text-[10px]">
                     {c.code}
                  </TableCell>
                  <TableCell>
                     {c.direction === "discount" ? "−" : "+"}
                     {c.type}
                  </TableCell>
                  <TableCell>
                     {c.type === "percent" ? `${c.amount}%` : `R$ ${c.amount}`}
                  </TableCell>
                  <TableCell>
                     {c.usedCount}
                     {c.maxUses ? ` / ${c.maxUses}` : ""}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

export function CreatedRenderer({
   label,
   name,
   meta,
}: {
   label: string;
   name: string;
   meta?: string;
}) {
   return (
      <div className="flex items-center gap-2">
         <Badge variant="outline" className="text-[10px]">
            {label}
         </Badge>
         <span className="font-medium">{name}</span>
         {meta ? <span className="text-muted-foreground">· {meta}</span> : null}
      </div>
   );
}

export function SetupServiceRenderer({
   data,
}: {
   data: {
      service: { id: string; name: string };
      meter: { id: string; name?: string } | null;
      prices: Array<{
         id: string;
         name: string;
         basePrice: string;
         interval: string | null;
      }>;
      benefits: Array<{ id: string; name: string }>;
   };
}) {
   return (
      <div className="flex flex-col gap-3">
         <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
               Serviço criado
            </Badge>
            <span className="font-medium">{data.service.name}</span>
         </div>
         {data.meter ? (
            <div className="flex items-center gap-2">
               <Badge variant="secondary" className="text-[10px]">
                  Medidor
               </Badge>
               <span>{data.meter.name ?? data.meter.id}</span>
            </div>
         ) : null}
         {data.prices.length > 0 ? (
            <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Preços ({data.prices.length})
               </span>
               <div className="flex flex-wrap gap-2">
                  {data.prices.map((p) => (
                     <Badge key={p.id} variant="outline">
                        {p.name} · R$ {p.basePrice}
                        {p.interval ? ` / ${p.interval}` : ""}
                     </Badge>
                  ))}
               </div>
            </div>
         ) : null}
         {data.benefits.length > 0 ? (
            <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Benefícios ({data.benefits.length})
               </span>
               <div className="flex flex-wrap gap-2">
                  {data.benefits.map((b) => (
                     <Badge key={b.id} variant="outline">
                        {b.name}
                     </Badge>
                  ))}
               </div>
            </div>
         ) : null}
      </div>
   );
}

export function BulkSetActiveRenderer({
   data,
}: {
   data: {
      count: number;
      isActive: boolean;
      services: Array<{ name: string }>;
   };
}) {
   return (
      <div className="flex flex-col gap-1">
         <span>
            {data.count} {data.count === 1 ? "serviço" : "serviços"}{" "}
            {data.isActive ? "ativados" : "arquivados"}.
         </span>
         <div className="flex flex-wrap gap-1">
            {data.services.map((s, i) => (
               <Badge key={`${s.name}-${i}`} variant="outline">
                  {s.name}
               </Badge>
            ))}
         </div>
      </div>
   );
}

export function BulkCreatedServicesRenderer({
   data,
}: {
   data: { count: number; services: Array<{ id: string; name: string }> };
}) {
   return (
      <div className="flex flex-col gap-1">
         <span>{data.count} serviços importados.</span>
         <div className="flex flex-wrap gap-1">
            {data.services.map((s) => (
               <Badge key={s.id} variant="outline">
                  {s.name}
               </Badge>
            ))}
         </div>
      </div>
   );
}
