import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import type { Outputs } from "@/integrations/orpc/client";

type ApiKeyRow = Outputs["apiKeys"]["list"][number];

export function buildApiKeysColumns(): ColumnDef<ApiKeyRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: { label: "Nome", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="font-medium">
               {row.original.name ?? "Sem nome"}
            </span>
         ),
      },
      {
         accessorKey: "start",
         header: "Chave",
         meta: { label: "Chave", filterVariant: "text" },
         cell: ({ row }) =>
            row.original.start ? (
               <code className="font-mono text-xs text-muted-foreground">
                  {row.original.start}***
               </code>
            ) : null,
      },
      {
         accessorKey: "createdAt",
         header: "Criada em",
         meta: { label: "Criada em" },
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {dayjs(row.original.createdAt).format("DD/MM/YYYY")}
            </span>
         ),
      },
   ];
}
