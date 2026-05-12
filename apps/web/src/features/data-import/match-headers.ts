import type { Table } from "@tanstack/react-table";
import type { ImportableColumn } from "./types";

function normalize(s: string) {
   return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
}

export function autoMatch(
   fileHeaders: string[],
   cols: ImportableColumn[],
): Record<string, string> {
   const mapping: Record<string, string> = {};
   for (const col of cols) {
      const normLabel = normalize(col.label);
      const normKey = normalize(col.key);
      const match = fileHeaders.find((h) => {
         const normH = normalize(h);
         return (
            normH === normLabel ||
            normH === normKey ||
            normH.includes(normLabel) ||
            normH.includes(normKey)
         );
      });
      if (match) mapping[col.key] = match;
   }
   return mapping;
}

export function getImportableColumns<TData>(
   table: Table<TData>,
   extra: ImportableColumn[] = [],
): ImportableColumn[] {
   return [
      ...table
         .getAllColumns()
         .filter(
            (col) =>
               col.id !== "__select" &&
               col.id !== "__actions" &&
               !col.columnDef.meta?.importIgnore,
         )
         .map((col) => {
            const def = col.columnDef;
            const accessorKey =
               "accessorKey" in def && def.accessorKey != null
                  ? String(def.accessorKey)
                  : col.id;
            return {
               key: accessorKey,
               label: col.columnDef.meta?.label ?? col.id,
            };
         }),
      ...extra,
   ];
}
