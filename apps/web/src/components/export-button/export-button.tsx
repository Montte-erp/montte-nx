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
import type { Table } from "@tanstack/react-table";
import { Upload } from "lucide-react";
import { useCallback } from "react";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import {
   buildExportPayload,
   collectExportColumns,
   downloadCsvExport,
   downloadJsonExport,
   downloadXlsxExport,
   type ExportOptions,
} from "@/lib/export-rows";

type ExportFormat = "csv" | "xlsx" | "json";
const EXPORT_FORMATS: { format: ExportFormat; label: string }[] = [
   { format: "csv", label: "CSV" },
   { format: "xlsx", label: "XLSX" },
   { format: "json", label: "JSON" },
];

interface ExportButtonProps<TData> {
   table: Table<TData>;
   fileBase: string;
   dateFormat?: string;
   onlySelected?: boolean;
   variant?: "icon" | "labelled";
}

export function ExportButton<TData>({
   table,
   fileBase,
   dateFormat,
   onlySelected = false,
   variant = "icon",
}: ExportButtonProps<TData>) {
   const { generate: generateCsv } = useCsvFile();
   const { generate: generateXlsx } = useXlsxFile();

   const handleExport = useCallback(
      (format: ExportFormat) => {
         const rows = onlySelected
            ? table.getSelectedRowModel().rows
            : table.getRowModel().rows;
         const cols = collectExportColumns(table);
         const { headers, data } = buildExportPayload(rows, cols);
         const opts: ExportOptions = {
            fileBase,
            suffix: onlySelected ? "-selecionados" : "",
            dateFormat,
         };
         if (format === "csv") {
            downloadCsvExport(generateCsv(data, headers), opts);
            return;
         }
         if (format === "json") {
            downloadJsonExport(data, opts);
            return;
         }
         downloadXlsxExport(generateXlsx(data, headers), opts);
      },
      [table, fileBase, dateFormat, onlySelected, generateCsv, generateXlsx],
   );

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            {variant === "icon" ? (
               <Button tooltip="Exportar" variant="outline" size="icon-sm">
                  <Upload />
                  <span className="sr-only">Exportar</span>
               </Button>
            ) : (
               <Button variant="outline" size="sm">
                  <Upload data-icon="inline-start" />
                  Exportar
               </Button>
            )}
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" className="z-[70]">
            <DropdownMenuLabel>
               {onlySelected ? "Exportar selecionados" : "Exportar"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
               {EXPORT_FORMATS.map(({ format, label }) => (
                  <DropdownMenuItem
                     key={format}
                     onClick={() => handleExport(format)}
                  >
                     {label}
                  </DropdownMenuItem>
               ))}
            </DropdownMenuGroup>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
