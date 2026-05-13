import { read as xlsxRead, utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import dayjs from "dayjs";
import { useCallback } from "react";

export type XlsxData = {
   headers: string[];
   rows: string[][];
};

function cellToString(cell: unknown): string {
   if (cell instanceof Date) return dayjs(cell).format("DD/MM/YYYY");
   return String(cell);
}

export function useXlsxFile() {
   const parse = useCallback(async (file: File): Promise<XlsxData> => {
      const wb = xlsxRead(new Uint8Array(await file.arrayBuffer()), {
         type: "array",
         cellDates: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      const data = xlsxUtils.sheet_to_json<unknown[]>(ws, {
         header: 1,
         defval: "",
         raw: false,
         dateNF: "dd/mm/yyyy",
      });
      if (data.length < 2) throw new Error("Planilha sem dados");
      const [headerRow, ...bodyRows] = data;
      return {
         headers: headerRow.map(cellToString),
         rows: bodyRows
            .filter((r) => r.some((c) => cellToString(c).trim() !== ""))
            .map((r) => r.map(cellToString)),
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

   return { parse, generate };
}
