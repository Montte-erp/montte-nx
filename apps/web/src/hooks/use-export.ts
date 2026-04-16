import { useCallback } from "react";
import { toast } from "sonner";
import { useCsvFile } from "./use-csv-file";
import { useXlsxFile } from "./use-xlsx-file";
import { useFileDownload } from "./use-file-download";

export function useExport<T>({
   data,
   filename,
   columns,
}: {
   data: T[];
   filename: string;
   columns: { label: string; getValue: (row: T) => string }[];
}) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const { download } = useFileDownload();
   const headers = columns.map((c) => c.label);

   const buildRows = useCallback(
      () =>
         data.map((row) =>
            Object.fromEntries(columns.map((c) => [c.label, c.getValue(row)])),
         ),
      [data, columns],
   );

   const exportCsv = useCallback(() => {
      download(csv.generate(buildRows(), headers), `${filename}.csv`);
      toast.success("Exportado.");
   }, [buildRows, csv, download, filename, headers]);

   const exportXlsx = useCallback(() => {
      download(xlsx.generate(buildRows(), headers), `${filename}.xlsx`);
      toast.success("Exportado.");
   }, [buildRows, xlsx, download, filename, headers]);

   return { exportCsv, exportXlsx };
}
