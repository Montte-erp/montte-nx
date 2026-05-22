import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Ban,
   Download,
   Eye,
   FileText,
   RefreshCcw,
   Send,
   Trash2,
} from "lucide-react";

export type NfeStatus =
   | "rascunho"
   | "pronta"
   | "transmitindo"
   | "processando"
   | "autorizada"
   | "rejeitada"
   | "denegada"
   | "cancelada"
   | "inutilizada"
   | "contingencia";

export type NfeRow = {
   id: string;
   numero: string;
   serie: string;
   modelo: string;
   cliente: string;
   cnpj: string;
   valor: string;
   emissao: string;
   contrato: string;
   operacao: string;
   ambiente: "normal" | "contingencia" | "homologacao";
   chave: string;
   recibo: string;
   protocolo: string;
   retorno: string;
   evento: string;
   status: NfeStatus;
};

export const nfeStatusLabels: Record<NfeStatus, string> = {
   rascunho: "Rascunho",
   pronta: "Pronta",
   transmitindo: "Transmitindo",
   processando: "Em processamento",
   autorizada: "Autorizada",
   rejeitada: "Rejeitada",
   denegada: "Denegada",
   cancelada: "Cancelada",
   inutilizada: "Inutilizada",
   contingencia: "Contingência EPEC",
};

export function NfeStatusBadge({ status }: { status: NfeStatus }) {
   if (status === "autorizada") {
      return <Badge variant="success">{nfeStatusLabels[status]}</Badge>;
   }
   if (status === "cancelada" || status === "denegada") {
      return <Badge variant="destructive">{nfeStatusLabels[status]}</Badge>;
   }
   if (status === "rejeitada" || status === "contingencia") {
      return (
         <Badge
            className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            variant="outline"
         >
            {nfeStatusLabels[status]}
         </Badge>
      );
   }
   if (status === "transmitindo" || status === "processando") {
      return <Badge variant="secondary">{nfeStatusLabels[status]}</Badge>;
   }
   return <Badge variant="outline">{nfeStatusLabels[status]}</Badge>;
}

function canTransmit(status: NfeStatus) {
   return (
      status !== "autorizada" &&
      status !== "cancelada" &&
      status !== "denegada" &&
      status !== "inutilizada"
   );
}

function canConsult(status: NfeStatus) {
   return (
      status === "transmitindo" ||
      status === "processando" ||
      status === "contingencia"
   );
}

export function buildNfeColumns({
   onOpen,
   onTransmit,
   onConsult,
   onCancel,
   onDownload,
   onDelete,
}: {
   onOpen: (row: NfeRow) => void;
   onTransmit: (id: string) => void;
   onConsult: (id: string) => void;
   onCancel: (id: string) => void;
   onDownload: (id: string) => void;
   onDelete: (id: string) => void;
}): ColumnDef<NfeRow>[] {
   return [
      {
         accessorKey: "numero",
         header: "Número",
         meta: { label: "Número", exportable: true },
         cell: ({ row }) => (
            <button
               className="text-left font-medium hover:underline"
               onClick={() => onOpen(row.original)}
               type="button"
            >
               {row.original.numero}
            </button>
         ),
      },
      {
         accessorKey: "serie",
         header: "Série",
         meta: { label: "Série", exportable: true },
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
         accessorKey: "operacao",
         header: "Operação",
         meta: { label: "Operação", exportable: true },
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
         accessorKey: "ambiente",
         header: "Ambiente",
         meta: { label: "Ambiente", exportable: true },
         cell: ({ row }) => (
            <span className="capitalize">{row.original.ambiente}</span>
         ),
      },
      {
         accessorKey: "retorno",
         header: "Retorno SEFAZ",
         size: 280,
         meta: { label: "Retorno SEFAZ", exportable: true },
         cell: ({ row }) => (
            <span className="line-clamp-1 text-muted-foreground">
               {row.original.retorno}
            </span>
         ),
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status", filterVariant: "select", exportable: true },
         cell: ({ row }) => <NfeStatusBadge status={row.original.status} />,
      },
      {
         id: "__actions",
         size: 280,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={() => onOpen(row.original)}
                  size="icon-sm"
                  tooltip="Ver detalhes"
                  variant="outline"
               >
                  <Eye />
               </Button>
               <Button
                  disabled={!canTransmit(row.original.status)}
                  onClick={() => onTransmit(row.original.id)}
                  size="icon-sm"
                  tooltip="Emitir agora"
                  variant="outline"
               >
                  <Send />
               </Button>
               <Button
                  disabled={!canConsult(row.original.status)}
                  onClick={() => onConsult(row.original.id)}
                  size="icon-sm"
                  tooltip="Consultar SEFAZ"
                  variant="outline"
               >
                  <RefreshCcw />
               </Button>
               <Button
                  disabled={row.original.status !== "autorizada"}
                  onClick={() => onDownload(row.original.id)}
                  size="icon-sm"
                  tooltip="Baixar XML/DANFE"
                  variant="outline"
               >
                  <Download />
               </Button>
               <Button
                  disabled={row.original.status !== "autorizada"}
                  onClick={() => onOpen(row.original)}
                  size="icon-sm"
                  tooltip="Eventos fiscais"
                  variant="outline"
               >
                  <FileText />
               </Button>
               <Button
                  disabled={row.original.status !== "autorizada"}
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
                  tooltip="Excluir NF-e local"
                  variant="outline"
               >
                  <Trash2 />
               </Button>
            </div>
         ),
      },
   ];
}
