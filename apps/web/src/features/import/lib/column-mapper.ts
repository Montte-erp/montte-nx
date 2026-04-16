import type { ColumnDef } from "../types";

export function guessMapping(headers: string[], columnDefs: ColumnDef[]) {
   return Object.fromEntries(
      headers.map((header) => {
         const match = columnDefs.find((def) =>
            def.patterns.some((p) => p.test(header)),
         );
         return [header, match ? match.field : "__skip__"];
      }),
   );
}

export function mappingStorageKey(featureKey: string, headers: string[]) {
   return `montte:${featureKey}:import:mapping:${[...headers].sort().join("\0")}`;
}
