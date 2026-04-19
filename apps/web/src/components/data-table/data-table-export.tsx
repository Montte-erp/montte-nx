import dayjs from "dayjs";
import { Download } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuGroup,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useDataTable } from "./data-table-root";

function downloadBlob(blob: Blob, filename: string) {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   setTimeout(() => URL.revokeObjectURL(url), 100);
}

interface DataTableExportButtonProps {
   exportFileName: string;
}

export function DataTableExportButton({
   exportFileName,
}: DataTableExportButtonProps) {
   const { table } = useDataTable();
   const { generate: generateCsv } = useCsvFile();
   const { generate: generateXlsx } = useXlsxFile();

   const exportCols = useMemo(
      () =>
         table
            .getAllColumns()
            .filter(
               (col) =>
                  col.id !== "__select" &&
                  col.id !== "__actions" &&
                  !col.columnDef.meta?.exportIgnore,
            ),
      [table],
   );

   const headers = useMemo(
      () => exportCols.map((col) => col.columnDef.meta?.label ?? col.id),
      [exportCols],
   );

   const buildRows = useCallback(
      (rows: ReturnType<typeof table.getRowModel>["rows"]) =>
         rows.map((row) => {
            const record: Record<string, string> = {};
            for (let i = 0; i < exportCols.length; i++) {
               const col = exportCols[i];
               const header = headers[i];
               const value = row.getValue(col.id);
               record[header] = value == null ? "" : String(value);
            }
            return record;
         }),
      [exportCols, headers],
   );

   const hasSelection = table.getSelectedRowModel().rows.length > 0;

   const handleExport = useCallback(
      (format: "csv" | "xlsx", selected: boolean) => {
         const rows = selected
            ? table.getSelectedRowModel().rows
            : table.getRowModel().rows;
         const data = buildRows(rows);
         const suffix = selected ? "-selecionados" : "";
         const dateStr = dayjs().format("YYYY-MM-DD");
         const filename = `${exportFileName}${suffix}-${dateStr}.${format}`;

         if (format === "csv") {
            downloadBlob(generateCsv(data, headers), filename);
            return;
         }
         downloadBlob(generateXlsx(data, headers), filename);
      },
      [table, buildRows, exportFileName, headers, generateCsv, generateXlsx],
   );

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button tooltip="Exportar" variant="outline" size="icon-sm">
               <Download />
               <span className="sr-only">Exportar</span>
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            <DropdownMenuLabel id="export-label">Exportar</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup aria-labelledby="export-label">
               <DropdownMenuItem onClick={() => handleExport("csv", false)}>
                  Exportar CSV
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => handleExport("xlsx", false)}>
                  Exportar XLSX
               </DropdownMenuItem>
            </DropdownMenuGroup>
            {hasSelection && (
               <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                     <DropdownMenuItem
                        onClick={() => handleExport("csv", true)}
                     >
                        Exportar selecionados (CSV)
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        onClick={() => handleExport("xlsx", true)}
                     >
                        Exportar selecionados (XLSX)
                     </DropdownMenuItem>
                  </DropdownMenuGroup>
               </>
            )}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
