import { parseBufferOrThrow, generateFromObjects } from "@f-o-t/csv";
import { useCallback } from "react";

const UTF8_BOM = String.fromCharCode(0xfeff);

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
         // BOM força o Excel a ler como UTF-8 (senão os acentos quebram);
         // ";" é o separador de lista do Excel pt-BR (senão tudo cai numa coluna).
         // O parse de import auto-detecta delimiter e encoding, então o round-trip segue ok.
         new Blob(
            [UTF8_BOM, generateFromObjects(rows, { headers, delimiter: ";" })],
            { type: "text/csv;charset=utf-8;" },
         ),
      [],
   );

   return { parse, generate };
}
