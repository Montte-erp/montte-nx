import type { ColumnDef } from "@tanstack/react-table";

export type TagRow = {
   id: string;
   name: string;
   color: string;
};

export function buildTagColumns(): ColumnDef<TagRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
               <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: row.original.color }}
               />
               <span className="font-medium truncate">{row.original.name}</span>
            </div>
         ),
      },
   ];
}
