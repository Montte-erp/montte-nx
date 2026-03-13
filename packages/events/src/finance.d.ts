import { z } from "zod";
import { type EmitFn } from "./catalog";
export declare const FINANCE_EVENTS: {
   readonly "finance.transaction_created": "finance.transaction_created";
   readonly "finance.transaction_updated": "finance.transaction_updated";
   readonly "finance.bank_account_connected": "finance.bank_account_connected";
   readonly "finance.category_created": "finance.category_created";
   readonly "finance.tag_created": "finance.tag_created";
   readonly "finance.budget_alert_triggered": "finance.budget_alert_triggered";
};
export type FinanceEventName =
   (typeof FINANCE_EVENTS)[keyof typeof FINANCE_EVENTS];
export declare const financeTransactionCreatedSchema: z.ZodObject<
   {
      transactionId: z.ZodString;
      type: z.ZodEnum<{
         expense: "expense";
         income: "income";
         transfer: "transfer";
      }>;
      bankAccountId: z.ZodString;
      categoryId: z.ZodOptional<z.ZodString>;
      amountCents: z.ZodNumber;
   },
   z.core.$strip
>;
export type FinanceTransactionCreatedEvent = z.infer<
   typeof financeTransactionCreatedSchema
>;
export declare function emitFinanceTransactionCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: FinanceTransactionCreatedEvent,
): Promise<void>;
export declare const financeTransactionUpdatedSchema: z.ZodObject<
   {
      transactionId: z.ZodString;
   },
   z.core.$strip
>;
export type FinanceTransactionUpdatedEvent = z.infer<
   typeof financeTransactionUpdatedSchema
>;
export declare function emitFinanceTransactionUpdated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: FinanceTransactionUpdatedEvent,
): Promise<void>;
export declare const financeBankAccountConnectedSchema: z.ZodObject<
   {
      bankAccountId: z.ZodString;
      type: z.ZodEnum<{
         cash: "cash";
         checking: "checking";
         credit_card: "credit_card";
         investment: "investment";
         other: "other";
         savings: "savings";
      }>;
   },
   z.core.$strip
>;
export type FinanceBankAccountConnectedEvent = z.infer<
   typeof financeBankAccountConnectedSchema
>;
export declare function emitFinanceBankAccountConnected(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: FinanceBankAccountConnectedEvent,
): Promise<void>;
export declare const financeCategoryCreatedSchema: z.ZodObject<
   {
      categoryId: z.ZodString;
   },
   z.core.$strip
>;
export type FinanceCategoryCreatedEvent = z.infer<
   typeof financeCategoryCreatedSchema
>;
export declare function emitFinanceCategoryCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: FinanceCategoryCreatedEvent,
): Promise<void>;
export declare const financeTagCreatedSchema: z.ZodObject<
   {
      tagId: z.ZodString;
   },
   z.core.$strip
>;
export type FinanceTagCreatedEvent = z.infer<typeof financeTagCreatedSchema>;
export declare function emitFinanceTagCreated(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: FinanceTagCreatedEvent,
): Promise<void>;
export declare const financeBudgetAlertTriggeredSchema: z.ZodObject<
   {
      budgetGoalId: z.ZodString;
      categoryId: z.ZodOptional<z.ZodString>;
      subcategoryId: z.ZodOptional<z.ZodString>;
      percentUsed: z.ZodNumber;
      teamId: z.ZodString;
   },
   z.core.$strip
>;
export type FinanceBudgetAlertTriggeredEvent = z.infer<
   typeof financeBudgetAlertTriggeredSchema
>;
export declare function emitFinanceBudgetAlertTriggered(
   emit: EmitFn,
   ctx: {
      organizationId: string;
      userId?: string;
      teamId?: string;
   },
   properties: FinanceBudgetAlertTriggeredEvent,
): Promise<void>;
//# sourceMappingURL=finance.d.ts.map
