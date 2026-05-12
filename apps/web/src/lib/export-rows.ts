import type { Row, Table } from "@tanstack/react-table";
import dayjs from "dayjs";

function downloadBlob(blob: Blob, filename: string) {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   setTimeout(() => URL.revokeObjectURL(url), 100);
}

export interface ExportableColumn<TData> {
   id: string;
   label: string;
   getValue: (row: TData, raw: unknown) => string;
}

export function collectExportColumns<TData>(
   table: Table<TData>,
): ExportableColumn<TData>[] {
   return table
      .getAllColumns()
      .filter(
         (col) =>
            col.id !== "__select" &&
            col.id !== "__actions" &&
            col.columnDef.meta?.exportable !== false &&
            !col.columnDef.meta?.exportIgnore,
      )
      .map((col) => ({
         id: col.id,
         label: col.columnDef.meta?.label ?? col.id,
         getValue: (row, raw) =>
            col.columnDef.meta?.exportValue?.(row, raw) ??
            (raw == null ? "" : String(raw)),
      }));
}

export function buildExportPayload<TData>(
   rows: Row<TData>[],
   cols: ExportableColumn<TData>[],
): { headers: string[]; data: Record<string, string>[] } {
   const headers = cols.map((c) => c.label);
   const data = rows.map((row) =>
      Object.fromEntries(
         cols.map((col, i) => [
            headers[i],
            col.getValue(row.original, row.getValue(col.id)),
         ]),
      ),
   );
   return { headers, data };
}

export interface ExportOptions {
   fileBase: string;
   suffix?: string;
   dateFormat?: string;
}

export function buildExportFilename(
   format: "csv" | "xlsx" | "json",
   opts: ExportOptions,
): string {
   const dateStr = dayjs().format(opts.dateFormat ?? "YYYY-MM-DD");
   return `${opts.fileBase}${opts.suffix ?? ""}-${dateStr}.${format}`;
}

export function downloadCsvExport(blob: Blob, opts: ExportOptions): void {
   downloadBlob(blob, buildExportFilename("csv", opts));
}

export function downloadXlsxExport(blob: Blob, opts: ExportOptions): void {
   downloadBlob(blob, buildExportFilename("xlsx", opts));
}

export function downloadJsonExport(
   data: Record<string, string>[],
   opts: ExportOptions,
): void {
   const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
   });
   downloadBlob(blob, buildExportFilename("json", opts));
}
