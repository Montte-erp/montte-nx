import { Badge } from "@packages/ui/components/badge";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { Compass, Sparkles } from "lucide-react";
import { Streamdown } from "streamdown";

interface AdvisorData {
   guidance?: string;
   fallback?: boolean;
   error?: string;
}

interface AdvisorArgs {
   situation?: string;
   question?: string;
   options?: string[];
}

export function AdvisorRenderer({
   data,
   args,
}: {
   data: AdvisorData;
   args: AdvisorArgs | null;
}) {
   if (!data.guidance) return null;
   return (
      <div className="flex flex-col gap-3">
         {args?.question ? (
            <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pergunta
               </span>
               <span className="italic text-muted-foreground">
                  {args.question}
               </span>
            </div>
         ) : null}
         {args?.options && args.options.length > 0 ? (
            <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Opções
               </span>
               <ul className="flex flex-col gap-0.5 pl-4">
                  {args.options.map((o, i) => (
                     <li
                        key={`opt-${i}`}
                        className="list-disc text-muted-foreground"
                     >
                        {o}
                     </li>
                  ))}
               </ul>
            </div>
         ) : null}
         <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
               {data.fallback ? "Advisor indisponível" : "Conselho"}
            </span>
            <Streamdown>{data.guidance}</Streamdown>
         </div>
      </div>
   );
}

interface LazyData {
   tools?: Array<{ name?: string; description?: string }>;
}

export function LazyDiscoveryRenderer({ data }: { data: LazyData }) {
   const tools = data.tools ?? [];
   if (tools.length === 0) return null;
   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <Compass className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-muted-foreground">
               {tools.length} ferramenta{tools.length === 1 ? "" : "s"}{" "}
               carregada{tools.length === 1 ? "" : "s"}
            </span>
         </div>
         <div className="flex flex-wrap gap-1">
            {tools.map((t, i) => (
               <span
                  key={`${t.name ?? "tool"}-${i}`}
                  className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px]"
                  title={t.description}
               >
                  {t.name ?? "tool"}
               </span>
            ))}
         </div>
      </div>
   );
}

interface SkillData {
   id?: string;
   name?: string;
   description?: string;
}

interface SkillArgs {
   skillId?: string;
}

export function SkillDiscoverRenderer({
   data,
   args,
}: {
   data: SkillData;
   args: SkillArgs | null;
}) {
   const name = data.name ?? args?.skillId ?? "—";
   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-muted-foreground">Skill ativada</span>
            <Badge className="font-medium" variant="outline">
               {name}
            </Badge>
         </div>
         {data.description ? (
            <p className="text-muted-foreground">{data.description}</p>
         ) : null}
      </div>
   );
}

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
      <Badge className="text-[10px]" variant={active ? "default" : "secondary"}>
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
         <Badge className="text-[10px]" variant="outline">
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
            <Badge className="text-[10px]" variant="outline">
               Serviço criado
            </Badge>
            <span className="font-medium">{data.service.name}</span>
         </div>
         {data.meter ? (
            <div className="flex items-center gap-2">
               <Badge className="text-[10px]" variant="secondary">
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
