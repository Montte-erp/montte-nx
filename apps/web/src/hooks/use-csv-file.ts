import { parseBufferOrThrow, generateFromObjects } from "@f-o-t/csv";

export type CsvData = {
   headers: string[];
   rows: string[][];
};

export function useCsvFile() {
   async function parse(file: File): Promise<CsvData> {
      const doc = parseBufferOrThrow(new Uint8Array(await file.arrayBuffer()), {
         hasHeaders: true,
         trimFields: true,
      });
      return {
         headers: doc.headers ?? [],
         rows: doc.rows.map((r) => r.fields),
      };
   }

   function generate(rows: Record<string, string>[], headers: string[]): Blob {
      return new Blob([generateFromObjects(rows, { headers })], {
         type: "text/csv;charset=utf-8;",
      });
   }

   return { parse, generate };
}
