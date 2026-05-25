import { z } from "zod";
import type { SortingState } from "@tanstack/react-table";

export const transactionSortIdSchema = z.enum([
   "amount",
   "bankAccountName",
   "categoryName",
   "creditCardName",
   "date",
   "dueDate",
   "name",
   "relationshipName",
   "status",
   "type",
]);

type TransactionSortId = z.infer<typeof transactionSortIdSchema>;

export interface TransactionSortingRule {
   id: TransactionSortId;
   desc: boolean;
}

export function normalizeTransactionSorting(
   sorting: SortingState,
): TransactionSortingRule[] {
   const normalized: TransactionSortingRule[] = [];
   for (const rule of sorting) {
      const result = transactionSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}
