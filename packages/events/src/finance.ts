import { z } from "zod";
import { type EmitFn, EVENT_CATEGORIES } from "./catalog";

export const FINANCE_EVENTS = {
   "finance.transaction_created": "finance.transaction_created",
   "finance.transaction_updated": "finance.transaction_updated",
   "finance.transaction_marked_paid": "finance.transaction_marked_paid",
   "finance.transaction_cancelled": "finance.transaction_cancelled",
   "finance.bank_account_connected": "finance.bank_account_connected",
   "finance.category_created": "finance.category_created",
   "finance.tag_created": "finance.tag_created",
   "finance.statement_imported": "finance.statement_imported",
} as const;

export type FinanceEventName =
   (typeof FINANCE_EVENTS)[keyof typeof FINANCE_EVENTS];

export const financeTransactionCreatedSchema = z.object({
   transactionId: z.string().uuid(),
   type: z.enum(["income", "expense", "transfer"]),
   bankAccountId: z.string().uuid(),
   categoryId: z.string().uuid().optional(),
   amountCents: z.number().int().nonnegative(),
});
export type FinanceTransactionCreatedEvent = z.infer<
   typeof financeTransactionCreatedSchema
>;

export function emitFinanceTransactionCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceTransactionCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.transaction_created"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeTransactionUpdatedSchema = z.object({
   transactionId: z.string().uuid(),
});
export type FinanceTransactionUpdatedEvent = z.infer<
   typeof financeTransactionUpdatedSchema
>;

export function emitFinanceTransactionUpdated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceTransactionUpdatedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.transaction_updated"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeBankAccountConnectedSchema = z.object({
   bankAccountId: z.string().uuid(),
   type: z.enum([
      "checking",
      "savings",
      "credit_card",
      "investment",
      "cash",
      "other",
   ]),
});
export type FinanceBankAccountConnectedEvent = z.infer<
   typeof financeBankAccountConnectedSchema
>;

export function emitFinanceBankAccountConnected(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceBankAccountConnectedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.bank_account_connected"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeCategoryCreatedSchema = z.object({
   categoryId: z.string().uuid(),
});
export type FinanceCategoryCreatedEvent = z.infer<
   typeof financeCategoryCreatedSchema
>;

export function emitFinanceCategoryCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceCategoryCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.category_created"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeTagCreatedSchema = z.object({
   tagId: z.string().uuid(),
});
export type FinanceTagCreatedEvent = z.infer<typeof financeTagCreatedSchema>;

export function emitFinanceTagCreated(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceTagCreatedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.tag_created"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeTransactionMarkedPaidSchema = z.object({
   transactionId: z.string().uuid(),
   type: z.enum(["income", "expense", "transfer"]),
   amountCents: z.number().int().nonnegative(),
});
export type FinanceTransactionMarkedPaidEvent = z.infer<
   typeof financeTransactionMarkedPaidSchema
>;

export function emitFinanceTransactionMarkedPaid(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceTransactionMarkedPaidEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.transaction_marked_paid"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeTransactionCancelledSchema = z.object({
   transactionId: z.string().uuid(),
});
export type FinanceTransactionCancelledEvent = z.infer<
   typeof financeTransactionCancelledSchema
>;

export function emitFinanceTransactionCancelled(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceTransactionCancelledEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.transaction_cancelled"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}

export const financeStatementImportedSchema = z.object({
   bankAccountId: z.string().uuid(),
   format: z.enum(["csv", "xlsx", "ofx"]),
   rowCount: z.number().int().nonnegative(),
});
export type FinanceStatementImportedEvent = z.infer<
   typeof financeStatementImportedSchema
>;

export function emitFinanceStatementImported(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceStatementImportedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.statement_imported"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}
