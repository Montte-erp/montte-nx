import { parseBufferOrThrow, generateFromObjects } from "@f-o-t/csv";
import { useCallback, useMemo } from "react";

export type CsvData = {
   headers: string[];
   rows: string[][];
};

export function useCsvFile() {
   const parse = useCallback(async (file: File): Promise<CsvData> => {
      const doc = parseBufferOrThrow(new Uint8Array(await file.arrayBuffer()), {
         hasHeaders: true,
         trimFields: true,
      });
      return {
         headers: doc.headers ?? [],
         rows: doc.rows.map((r) => r.fields),
      };
   }, []);

   const generate = useCallback(
      (rows: Record<string, string>[], headers: string[]): Blob =>
         new Blob([generateFromObjects(rows, { headers })], {
            type: "text/csv;charset=utf-8;",
         }),
      [],
   );

   return useMemo(() => ({ parse, generate }), [parse, generate]);
}
