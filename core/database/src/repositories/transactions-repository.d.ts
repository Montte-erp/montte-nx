import type { ConditionGroup } from "@f-o-t/condition-evaluator";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateTransactionInput,
   type UpdateTransactionInput,
} from "@core/database/schemas/transactions";
export interface ListTransactionsFilter {
   teamId: string;
   type?: "income" | "expense" | "transfer";
   bankAccountId?: string;
   categoryId?: string;
   tagId?: string;
   contactId?: string;
   dateFrom?: string;
   dateTo?: string;
   search?: string;
   page?: number;
   pageSize?: number;
   uncategorized?: boolean;
   creditCardId?: string;
   paymentMethod?: string;
   conditionGroup?: ConditionGroup;
}
export declare function ensureTransactionOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   teamId: string;
   name: string | null;
   type: "expense" | "income" | "transfer";
   amount: string;
   description: string | null;
   date: string;
   bankAccountId: string | null;
   destinationBankAccountId: string | null;
   creditCardId: string | null;
   categoryId: string | null;
   attachmentUrl: string | null;
   paymentMethod:
      | "automatic_debit"
      | "boleto"
      | "cash"
      | "cheque"
      | "credit_card"
      | "debit_card"
      | "other"
      | "pix"
      | "transfer"
      | null;
   isInstallment: boolean;
   installmentCount: number | null;
   installmentNumber: number | null;
   installmentGroupId: string | null;
   statementPeriod: string | null;
   contactId: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function validateTransactionReferences(
   db: DatabaseInstance,
   teamId: string,
   refs: {
      bankAccountId?: string | null;
      destinationBankAccountId?: string | null;
      categoryId?: string | null;
      contactId?: string | null;
      tagIds?: string[];
      date?: Date | string | null;
   },
): Promise<void>;
export declare function createTransaction(
   db: DatabaseInstance,
   teamId: string,
   data: CreateTransactionInput,
   tagIds?: string[],
): Promise<
   | {
        amount: string;
        attachmentUrl: string | null;
        bankAccountId: string | null;
        categoryId: string | null;
        contactId: string | null;
        createdAt: Date;
        creditCardId: string | null;
        date: string;
        description: string | null;
        destinationBankAccountId: string | null;
        id: string;
        installmentCount: number | null;
        installmentGroupId: string | null;
        installmentNumber: number | null;
        isInstallment: boolean;
        name: string | null;
        paymentMethod:
           | "automatic_debit"
           | "boleto"
           | "cash"
           | "cheque"
           | "credit_card"
           | "debit_card"
           | "other"
           | "pix"
           | "transfer"
           | null;
        statementPeriod: string | null;
        teamId: string;
        type: "expense" | "income" | "transfer";
        updatedAt: Date;
     }
   | undefined
>;
export declare function listTransactions(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
): Promise<{
   data: {
      id: string;
      teamId: string;
      name: string | null;
      type: "expense" | "income" | "transfer";
      amount: string;
      description: string | null;
      date: string;
      bankAccountId: string | null;
      destinationBankAccountId: string | null;
      creditCardId: string | null;
      categoryId: string | null;
      attachmentUrl: string | null;
      paymentMethod:
         | "automatic_debit"
         | "boleto"
         | "cash"
         | "cheque"
         | "credit_card"
         | "debit_card"
         | "other"
         | "pix"
         | "transfer"
         | null;
      isInstallment: boolean;
      installmentCount: number | null;
      installmentNumber: number | null;
      installmentGroupId: string | null;
      statementPeriod: string | null;
      contactId: string | null;
      createdAt: Date;
      updatedAt: Date;
      categoryName: string | null;
      creditCardName: string | null;
      bankAccountName: string | null;
      contactName: string | null;
   }[];
   total: number;
}>;
export declare function getTransactionsSummary(
   db: DatabaseInstance,
   filter: ListTransactionsFilter,
): Promise<{
   totalCount: number;
   incomeTotal: string;
   expenseTotal: string;
   balance: string;
}>;
export declare function getTransactionWithTags(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string | null;
   type: "expense" | "income" | "transfer";
   amount: string;
   description: string | null;
   date: string;
   bankAccountId: string | null;
   destinationBankAccountId: string | null;
   creditCardId: string | null;
   categoryId: string | null;
   attachmentUrl: string | null;
   paymentMethod:
      | "automatic_debit"
      | "boleto"
      | "cash"
      | "cheque"
      | "credit_card"
      | "debit_card"
      | "other"
      | "pix"
      | "transfer"
      | null;
   isInstallment: boolean;
   installmentCount: number | null;
   installmentNumber: number | null;
   installmentGroupId: string | null;
   statementPeriod: string | null;
   contactId: string | null;
   createdAt: Date;
   updatedAt: Date;
   tagIds: string[];
} | null>;
export declare function updateTransaction(
   db: DatabaseInstance,
   id: string,
   data: UpdateTransactionInput,
   tagIds?: string[],
): Promise<{
   id: string;
   teamId: string;
   name: string | null;
   type: "expense" | "income" | "transfer";
   amount: string;
   description: string | null;
   date: string;
   bankAccountId: string | null;
   destinationBankAccountId: string | null;
   creditCardId: string | null;
   categoryId: string | null;
   attachmentUrl: string | null;
   paymentMethod:
      | "automatic_debit"
      | "boleto"
      | "cash"
      | "cheque"
      | "credit_card"
      | "debit_card"
      | "other"
      | "pix"
      | "transfer"
      | null;
   isInstallment: boolean;
   installmentCount: number | null;
   installmentNumber: number | null;
   installmentGroupId: string | null;
   statementPeriod: string | null;
   contactId: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteTransaction(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function createTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
   teamId: string,
   items: {
      serviceId?: string | null;
      description?: string | null;
      quantity: string;
      unitPrice: string;
   }[],
): Promise<void>;
export declare function getTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
): Promise<
   {
      id: string;
      transactionId: string;
      serviceId: string | null;
      teamId: string;
      description: string | null;
      quantity: string;
      unitPrice: string;
      createdAt: Date;
   }[]
>;
export declare function replaceTransactionItems(
   db: DatabaseInstance,
   transactionId: string,
   teamId: string,
   items: {
      serviceId?: string | null;
      description?: string | null;
      quantity: string;
      unitPrice: string;
   }[],
): Promise<void>;
//# sourceMappingURL=transactions-repository.d.ts.map
