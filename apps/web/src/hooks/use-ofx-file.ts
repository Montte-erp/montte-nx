import { getTransactions, parseBufferOrThrow } from "@f-o-t/ofx";
import dayjs from "dayjs";
import { useCallback } from "react";

export type OfxData = {
   headers: string[];
   rows: string[][];
};

const HEADERS = ["date", "amount", "type", "name", "fitid"];

export function useOfxFile() {
   const parse = useCallback(async (file: File): Promise<OfxData> => {
      const buffer = await file.arrayBuffer();
      const doc = parseBufferOrThrow(new Uint8Array(buffer));
      const txs = getTransactions(doc);
      const rows = txs.map((tx) => [
         dayjs(tx.DTPOSTED.toDate()).format("YYYY-MM-DD"),
         tx.TRNAMT.toFixed(2).replace(".", ","),
         tx.TRNTYPE,
         tx.NAME ?? tx.MEMO ?? "",
         tx.FITID ?? "",
      ]);
      return { headers: HEADERS, rows };
   }, []);

   return { parse };
}
