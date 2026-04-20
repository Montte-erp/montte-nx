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

function useTableExport() {
   const { table, storageKey } = useDataTable();
   const exportFileBase = storageKey.replace(/^montte:datatable:/, "");
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
         rows.map((row) =>
            Object.fromEntries(
               exportCols.map((col, i) => [
                  headers[i],
                  row.getValue(col.id) == null
                     ? ""
                     : String(row.getValue(col.id)),
               ]),
            ),
         ),
      [exportCols, headers],
   );

   const exportRows = useCallback(
      (
         format: "csv" | "xlsx",
         rows: ReturnType<typeof table.getRowModel>["rows"],
         suffix: string,
      ) => {
         const data = buildRows(rows);
         const dateStr = dayjs().format("YYYY-MM-DD");
         const filename = `${exportFileBase}${suffix}-${dateStr}.${format}`;
         if (format === "csv") {
            downloadBlob(generateCsv(data, headers), filename);
            return;
         }
         downloadBlob(generateXlsx(data, headers), filename);
      },
      [buildRows, exportFileBase, headers, generateCsv, generateXlsx],
   );

   return { table, exportRows };
}

const EXPORT_FORMATS: { format: "csv" | "xlsx"; label: string }[] = [
   { format: "csv", label: "CSV" },
   { format: "xlsx", label: "XLSX" },
];

export function DataTableExportButton() {
   const { table, exportRows } = useTableExport();

   const handleExport = useCallback(
      (format: "csv" | "xlsx") =>
         exportRows(format, table.getRowModel().rows, ""),
      [table, exportRows],
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
               {EXPORT_FORMATS.map(({ format, label }) => (
                  <DropdownMenuItem
                     key={format}
                     onClick={() => handleExport(format)}
                  >
                     Exportar {label}
                  </DropdownMenuItem>
               ))}
            </DropdownMenuGroup>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

export function DataTableExportSelectedButton() {
   const { table, exportRows } = useTableExport();

   const handleExport = useCallback(
      (format: "csv" | "xlsx") =>
         exportRows(format, table.getSelectedRowModel().rows, "-selecionados"),
      [table, exportRows],
   );

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
               <Download data-icon="inline-start" />
               Exportar
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            <DropdownMenuLabel>Exportar selecionados</DropdownMenuLabel>
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
