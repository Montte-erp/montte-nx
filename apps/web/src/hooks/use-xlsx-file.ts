import { read as xlsxRead, utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import { useCallback, useMemo } from "react";

export type XlsxData = {
   headers: string[];
   rows: string[][];
};

export function useXlsxFile() {
   const parse = useCallback(async (file: File): Promise<XlsxData> => {
      const wb = xlsxRead(new Uint8Array(await file.arrayBuffer()), {
         type: "array",
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      const data = xlsxUtils.sheet_to_json<unknown[]>(ws, {
         header: 1,
         defval: "",
      });
      if (data.length < 2) throw new Error("Planilha sem dados");
      return {
         headers: (data[0] as unknown[]).map(String),
         rows: (data.slice(1) as unknown[][])
            .filter((r) => r.some((c) => String(c).trim() !== ""))
            .map((r) => r.map(String)),
      };
   }, []);

   const generate = useCallback(
      (rows: Record<string, string>[], headers: string[]): Blob => {
         const ws = xlsxUtils.json_to_sheet(rows, { header: headers });
         const wb = xlsxUtils.book_new();
         xlsxUtils.book_append_sheet(wb, ws, "Modelo");
         return new Blob([xlsxWrite(wb, { type: "array", bookType: "xlsx" })], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
         });
      },
      [],
   );

   return useMemo(() => ({ parse, generate }), [parse, generate]);
}
