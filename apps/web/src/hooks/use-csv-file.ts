import { parseBufferOrThrow } from "@f-o-t/csv";

export type CsvData = {
   headers: string[];
   rows: string[][];
};

function parseCsvBuffer(buffer: ArrayBuffer): CsvData {
   const doc = parseBufferOrThrow(new Uint8Array(buffer), {
      hasHeaders: true,
      trimFields: true,
   });
   return {
      headers: doc.headers ?? [],
      rows: doc.rows.map((r) => r.fields),
   };
}

export function useCsvFile() {
   function readFile(file: File): Promise<CsvData> {
      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");
               resolve(parseCsvBuffer(buffer));
            } catch (err) {
               reject(err);
            }
         };
         reader.onerror = () => reject(new Error("Falha ao ler arquivo CSV"));
         reader.readAsArrayBuffer(file);
      });
   }

   return { parse: parseCsvBuffer, readFile };
}
