import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Trash2 } from "lucide-react";
import { REPORT_LABELS, type SavedReport } from "./report-labels";

interface BuildReportsColumnsOptions {
   onRemove?: (report: SavedReport) => void;
}

export function buildReportsColumns(
   options: BuildReportsColumnsOptions = {},
): ColumnDef<SavedReport>[] {
   const { onRemove } = options;
   return [
      {
         id: "name",
         accessorKey: "name",
         header: "Nome",
         meta: { label: "Nome", exportable: true },
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         id: "type",
         accessorKey: "type",
         header: "Tipo",
         meta: { label: "Tipo", exportable: true },
         cell: ({ row }) => {
            const Icon = REPORT_LABELS[row.original.type].icon;
            return (
               <span className="inline-flex items-center gap-2">
                  <Icon className="text-muted-foreground size-4" />
                  {REPORT_LABELS[row.original.type].label}
               </span>
            );
         },
      },
      {
         id: "period",
         header: "Período",
         enableSorting: false,
         meta: { label: "Período" },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {dayjs(row.original.config.dateFrom).format("DD/MM/YYYY")} —{" "}
               {dayjs(row.original.config.dateTo).format("DD/MM/YYYY")}
            </span>
         ),
      },
      {
         id: "createdAt",
         accessorKey: "createdAt",
         header: "Criado em",
         meta: { label: "Criado em" },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {dayjs(row.original.createdAt).format("DD/MM/YYYY")}
            </span>
         ),
      },
      {
         id: "__actions",
         size: 80,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-end">
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={(event) => {
                     event.stopPropagation();
                     onRemove?.(row.original);
                  }}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      },
   ];
}
