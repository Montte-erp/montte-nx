import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { PauseCircle, RefreshCw, Trash2 } from "lucide-react";

export type ContratoStatus =
   | "ativo"
   | "em_assinatura"
   | "pausado"
   | "encerrado"
   | "revisar_reajuste";
export type PeriodicidadeContrato = "mensal" | "trimestral" | "anual";

export type ContratoRow = {
   id: string;
   numero: string;
   cliente: string;
   servico: string;
   inicioVigencia: string;
   fimVigencia: string;
   diaCobranca: string;
   valorRecorrente: string;
   periodicidade: PeriodicidadeContrato;
   proximaCobranca: string;
   reajusteIndice: string;
   status: ContratoStatus;
};

const statusLabels: Record<ContratoStatus, string> = {
   ativo: "Ativo",
   em_assinatura: "Em assinatura",
   pausado: "Pausado",
   encerrado: "Encerrado",
   revisar_reajuste: "Revisar reajuste",
};

const periodicidadeLabels: Record<PeriodicidadeContrato, string> = {
   mensal: "Mensal",
   trimestral: "Trimestral",
   anual: "Anual",
};

export function ContratoStatusBadge({ status }: { status: ContratoStatus }) {
   if (status === "ativo")
      return <Badge variant="success">{statusLabels[status]}</Badge>;
   if (status === "encerrado" || status === "revisar_reajuste")
      return <Badge variant="destructive">{statusLabels[status]}</Badge>;
   if (status === "em_assinatura")
      return <Badge variant="secondary">{statusLabels[status]}</Badge>;
   return <Badge variant="outline">{statusLabels[status]}</Badge>;
}

export function buildContratosColumns({
   onRenew,
   onPause,
   onDelete,
}: {
   onRenew: (id: string) => void;
   onPause: (id: string) => void;
   onDelete: (id: string) => void;
}): ColumnDef<ContratoRow>[] {
   return [
      {
         accessorKey: "numero",
         header: "Contrato",
         meta: { label: "Contrato", exportable: true },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.numero}</span>
         ),
      },
      {
         accessorKey: "cliente",
         header: "Cliente",
         meta: { label: "Cliente", filterVariant: "text", exportable: true },
         cell: ({ row }) => (
            <span className="truncate">{row.original.cliente}</span>
         ),
      },
      {
         accessorKey: "servico",
         header: "Serviço",
         meta: { label: "Serviço", exportable: true },
         cell: ({ row }) => (
            <span className="truncate">{row.original.servico}</span>
         ),
      },
      {
         accessorKey: "valorRecorrente",
         header: "Recorrência",
         meta: { label: "Recorrência", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="font-medium tabular-nums">
               {row.original.valorRecorrente}
            </span>
         ),
      },
      {
         accessorKey: "periodicidade",
         header: "Periodicidade",
         meta: { label: "Periodicidade", exportable: true },
         cell: ({ row }) => periodicidadeLabels[row.original.periodicidade],
      },
      {
         accessorKey: "diaCobranca",
         header: "Dia cobrança",
         meta: { label: "Dia cobrança", align: "right", exportable: true },
      },
      {
         accessorKey: "proximaCobranca",
         header: "Próxima cobrança",
         meta: { label: "Próxima cobrança", exportable: true },
      },
      {
         accessorKey: "fimVigencia",
         header: "Fim vigência",
         meta: { label: "Fim vigência", exportable: true },
      },
      {
         accessorKey: "reajusteIndice",
         header: "Reajuste",
         meta: { label: "Reajuste", exportable: true },
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status", filterVariant: "select", exportable: true },
         cell: ({ row }) => (
            <ContratoStatusBadge status={row.original.status} />
         ),
      },
      {
         id: "__actions",
         size: 120,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={() => onRenew(row.original.id)}
                  size="icon-sm"
                  tooltip="Renovar contrato"
                  variant="outline"
               >
                  <RefreshCw />
               </Button>
               <Button
                  disabled={row.original.status === "pausado"}
                  onClick={() => onPause(row.original.id)}
                  size="icon-sm"
                  tooltip="Pausar recorrência"
                  variant="outline"
               >
                  <PauseCircle />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original.id)}
                  size="icon-sm"
                  tooltip="Excluir contrato"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      },
   ];
}
