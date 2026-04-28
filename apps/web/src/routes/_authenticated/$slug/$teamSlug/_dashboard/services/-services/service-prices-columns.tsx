import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { format, of } from "@f-o-t/money";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";

export type ServicePrice = Outputs["services"]["getVariants"][number];

export const PRICING_TYPE_LABEL: Record<ServicePrice["type"], string> = {
   flat: "Fixo",
   per_unit: "Por unidade",
   metered: "Medido",
};

export const INTERVAL_LABEL: Record<ServicePrice["interval"], string> = {
   hourly: "Por hora",
   shift: "Por turno",
   daily: "Diária",
   weekly: "Semanal",
   monthly: "Mensal",
   semestral: "Semestral",
   annual: "Anual",
   one_time: "Único",
};

interface BuildArgs {
   meterNameById: Record<string, string>;
   onEdit: (price: ServicePrice) => void;
   onToggle: (price: ServicePrice) => void;
   onDelete: (price: ServicePrice) => void;
   onDuplicate: (price: ServicePrice) => void;
}

export function buildPriceColumns({
   meterNameById,
   onEdit,
   onToggle,
   onDelete,
   onDuplicate,
}: BuildArgs): ColumnDef<ServicePrice>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: { label: "Nome" },
         cell: ({ row }) => {
            const p = row.original;
            const subInfo: string[] = [];
            if (p.trialDays && p.trialDays > 0)
               subInfo.push(`Trial ${p.trialDays}d`);
            if (p.autoEnroll) subInfo.push("Auto-enroll");
            if (p.priceCap)
               subInfo.push(`Cap ${format(of(p.priceCap, "BRL"), "pt-BR")}`);
            if (p.type === "metered" && p.meterId)
               subInfo.push(`Meter: ${meterNameById[p.meterId] ?? "—"}`);
            return (
               <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{p.name}</span>
                  {subInfo.length > 0 && (
                     <span className="text-xs text-muted-foreground">
                        {subInfo.join(" · ")}
                     </span>
                  )}
               </div>
            );
         },
      },
      {
         accessorKey: "interval",
         header: "Intervalo",
         meta: { label: "Intervalo" },
         cell: ({ row }) => INTERVAL_LABEL[row.original.interval],
      },
      {
         accessorKey: "basePrice",
         header: "Valor",
         meta: { label: "Valor", align: "right" as const },
         cell: ({ row }) => {
            const p = row.original;
            const value = format(of(p.basePrice, "BRL"), "pt-BR");
            return (
               <span className="tabular-nums font-medium">
                  {value}
                  {p.interval !== "one_time" && (
                     <span className="text-xs text-muted-foreground">
                        {" "}
                        / {INTERVAL_LABEL[p.interval].toLowerCase()}
                     </span>
                  )}
               </span>
            );
         },
      },
      {
         accessorKey: "isActive",
         header: "Status",
         meta: { label: "Status" },
         cell: ({ row }) => (
            <Badge variant="outline">
               {row.original.isActive ? "Ativo" : "Inativo"}
            </Badge>
         ),
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" tooltip="Ações">
                     <MoreVertical />
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(row.original)}>
                     Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(row.original)}>
                     Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggle(row.original)}>
                     {row.original.isActive ? "Desativar" : "Reativar"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                     className="text-destructive"
                     onClick={() => onDelete(row.original)}
                  >
                     Excluir
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         ),
      },
   ];
}
