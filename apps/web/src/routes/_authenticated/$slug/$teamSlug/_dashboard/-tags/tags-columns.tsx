import type { ColumnDef } from "@tanstack/react-table";

export type TagRow = {
   id: string;
   name: string;
   color: string;
   description: string | null;
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
               <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate">{row.original.name}</span>
                  {row.original.description && (
                     <span className="text-xs text-muted-foreground truncate">
                        {row.original.description}
                     </span>
                  )}
               </div>
            </div>
         ),
      },
   ];
}
