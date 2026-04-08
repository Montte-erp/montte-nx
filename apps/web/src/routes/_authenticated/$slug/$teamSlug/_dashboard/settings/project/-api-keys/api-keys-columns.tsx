import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Trash2 } from "lucide-react";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";

export type ApiKeyRow = {
   id: string;
   name: string | null;
   createdAt: Date;
   prefix: string | null;
   start: string | null;
};

export function buildApiKeysColumns(
   onRevoke: (keyId: string) => void,
   isPending: boolean,
): ColumnDef<ApiKeyRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <span className="font-medium">
               {row.original.name ?? "Sem nome"}
            </span>
         ),
      },
      {
         accessorKey: "start",
         header: "Chave",
         cell: ({ row }) =>
            row.original.start ? (
               <Badge variant="outline" className="font-mono text-xs">
                  {row.original.start}***
               </Badge>
            ) : null,
      },
      {
         accessorKey: "createdAt",
         header: "Criada em",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {dayjs(row.original.createdAt).format("DD/MM/YYYY")}
            </span>
         ),
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            <Button
               size="sm"
               variant="ghost"
               onClick={() => onRevoke(row.original.id)}
               disabled={isPending}
            >
               <Trash2 className="size-4 text-destructive" />
            </Button>
         ),
      },
   ];
}
