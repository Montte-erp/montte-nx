import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, FileCheck2, Trash2 } from "lucide-react";

export type NfeStatus = "rascunho" | "validacao" | "autorizada" | "cancelada";

export type NfeRow = {
   id: string;
   numero: string;
   cliente: string;
   cnpj: string;
   valor: string;
   emissao: string;
   contrato: string;
   status: NfeStatus;
};

const statusLabels: Record<NfeStatus, string> = {
   rascunho: "Rascunho",
   validacao: "Em validação",
   autorizada: "Autorizada",
   cancelada: "Cancelada",
};

export function NfeStatusBadge({ status }: { status: NfeStatus }) {
   if (status === "autorizada") {
      return <Badge variant="success">{statusLabels[status]}</Badge>;
   }
   if (status === "cancelada") {
      return <Badge variant="destructive">{statusLabels[status]}</Badge>;
   }
   if (status === "validacao") {
      return <Badge variant="secondary">{statusLabels[status]}</Badge>;
   }
   return <Badge variant="outline">{statusLabels[status]}</Badge>;
}

export function buildNfeColumns({
   onAuthorize,
   onCancel,
   onDelete,
}: {
   onAuthorize: (id: string) => void;
   onCancel: (id: string) => void;
   onDelete: (id: string) => void;
}): ColumnDef<NfeRow>[] {
   return [
      {
         accessorKey: "numero",
         header: "Número",
         meta: { label: "Número", exportable: true },
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
         accessorKey: "cnpj",
         header: "CNPJ",
         meta: { label: "CNPJ", exportable: true },
      },
      {
         accessorKey: "contrato",
         header: "Contrato",
         meta: { label: "Contrato", exportable: true },
      },
      {
         accessorKey: "valor",
         header: "Valor",
         meta: { label: "Valor", align: "right", exportable: true },
         cell: ({ row }) => (
            <span className="font-medium tabular-nums">
               {row.original.valor}
            </span>
         ),
      },
      {
         accessorKey: "emissao",
         header: "Emissão",
         meta: { label: "Emissão", exportable: true },
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status", filterVariant: "select", exportable: true },
         cell: ({ row }) => <NfeStatusBadge status={row.original.status} />,
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
                  disabled={row.original.status === "autorizada"}
                  onClick={() => onAuthorize(row.original.id)}
                  size="icon-sm"
                  tooltip="Autorizar NF-e"
                  variant="outline"
               >
                  <FileCheck2 />
               </Button>
               <Button
                  disabled={row.original.status === "cancelada"}
                  onClick={() => onCancel(row.original.id)}
                  size="icon-sm"
                  tooltip="Cancelar NF-e"
                  variant="outline"
               >
                  <Ban />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original.id)}
                  size="icon-sm"
                  tooltip="Excluir NF-e"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      },
   ];
}
