import type { RawData } from "../types";

export function applyMapping(
   rawData: RawData,
   mapping: Record<string, string>,
) {
   const entries = rawData.headers
      .map((header, idx) => ({ field: mapping[header] ?? "__skip__", idx }))
      .filter(({ field }) => field !== "__skip__");

   return rawData.rows
      .filter((row) => row.some((cell) => cell.trim() !== ""))
      .map((row) =>
         Object.fromEntries(
            entries.map(({ field, idx }) => [field, (row[idx] ?? "").trim()]),
         ),
      );
}

export function getSampleValues(rawData: RawData, header: string) {
   const idx = rawData.headers.indexOf(header);
   if (idx === -1) return "";
   return rawData.rows
      .slice(0, 3)
      .map((r) => (r[idx] ?? "").trim())
      .filter(Boolean)
      .join(", ");
}
