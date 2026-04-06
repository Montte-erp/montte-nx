import { read as xlsxRead, utils as xlsxUtils } from "xlsx";

export type XlsxData = {
   headers: string[];
   rows: string[][];
};

function parseXlsxBuffer(buffer: ArrayBuffer): XlsxData {
   const wb = xlsxRead(buffer, { type: "array" });
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
}

export function useXlsxFile() {
   function readFile(file: File): Promise<XlsxData> {
      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");
               resolve(parseXlsxBuffer(buffer));
            } catch (err) {
               reject(err);
            }
         };
         reader.onerror = () => reject(new Error("Falha ao ler planilha"));
         reader.readAsArrayBuffer(file);
      });
   }

   return { parse: parseXlsxBuffer, readFile };
}
