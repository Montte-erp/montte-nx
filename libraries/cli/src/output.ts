export function printJson(data: unknown): void {
   console.log(JSON.stringify(data, null, 2));
}

export function printTable(
   rows: Record<string, unknown>[],
   columns?: string[],
): void {
   if (rows.length === 0) {
      console.log("No results.");
      return;
   }
   const keys = columns ?? Object.keys(rows[0] ?? {});
   const widths = keys.map((key) =>
      Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length)),
   );
   const header = keys.map((k, i) => k.padEnd(widths[i] ?? 0)).join("  ");
   const separator = widths.map((w) => "-".repeat(w)).join("  ");
   console.log(header);
   console.log(separator);
   for (const row of rows) {
      const line = keys
         .map((k, i) => String(row[k] ?? "").padEnd(widths[i] ?? 0))
         .join("  ");
      console.log(line);
   }
}

export function printRecord(record: Record<string, unknown>): void {
   const maxKey = Math.max(...Object.keys(record).map((k) => k.length));
   for (const [key, value] of Object.entries(record)) {
      console.log(`${key.padEnd(maxKey)}  ${value}`);
   }
}
