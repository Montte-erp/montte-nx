import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateBankAccountInput,
   type UpdateBankAccountInput,
} from "@core/database/schemas/bank-accounts";
export declare function createBankAccount(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBankAccountInput,
): Promise<{
   accountNumber: string | null;
   bankCode: string | null;
   bankName: string | null;
   branch: string | null;
   color: string;
   createdAt: Date;
   iconUrl: string | null;
   id: string;
   initialBalance: string;
   initialBalanceDate: string | null;
   name: string;
   notes: string | null;
   status: "active" | "archived";
   teamId: string;
   type: "cash" | "checking" | "investment" | "payment" | "savings";
   updatedAt: Date;
}>;
export declare function listBankAccounts(
   db: DatabaseInstance,
   teamId: string,
   includeArchived?: boolean,
): Promise<
   {
      accountNumber: string | null;
      bankCode: string | null;
      bankName: string | null;
      branch: string | null;
      color: string;
      createdAt: Date;
      iconUrl: string | null;
      id: string;
      initialBalance: string;
      initialBalanceDate: string | null;
      name: string;
      notes: string | null;
      status: "active" | "archived";
      teamId: string;
      type: "cash" | "checking" | "investment" | "payment" | "savings";
      updatedAt: Date;
   }[]
>;
export declare function getBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<{
   accountNumber: string | null;
   bankCode: string | null;
   bankName: string | null;
   branch: string | null;
   color: string;
   createdAt: Date;
   iconUrl: string | null;
   id: string;
   initialBalance: string;
   initialBalanceDate: string | null;
   name: string;
   notes: string | null;
   status: "active" | "archived";
   teamId: string;
   type: "cash" | "checking" | "investment" | "payment" | "savings";
   updatedAt: Date;
} | null>;
export declare function ensureBankAccountOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   accountNumber: string | null;
   bankCode: string | null;
   bankName: string | null;
   branch: string | null;
   color: string;
   createdAt: Date;
   iconUrl: string | null;
   id: string;
   initialBalance: string;
   initialBalanceDate: string | null;
   name: string;
   notes: string | null;
   status: "active" | "archived";
   teamId: string;
   type: "cash" | "checking" | "investment" | "payment" | "savings";
   updatedAt: Date;
}>;
export declare function updateBankAccount(
   db: DatabaseInstance,
   id: string,
   data: UpdateBankAccountInput,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "cash" | "checking" | "investment" | "payment" | "savings";
   status: "active" | "archived";
   color: string;
   iconUrl: string | null;
   bankCode: string | null;
   bankName: string | null;
   branch: string | null;
   accountNumber: string | null;
   initialBalance: string;
   initialBalanceDate: string | null;
   notes: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function archiveBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "cash" | "checking" | "investment" | "payment" | "savings";
   status: "active" | "archived";
   color: string;
   iconUrl: string | null;
   bankCode: string | null;
   bankName: string | null;
   branch: string | null;
   accountNumber: string | null;
   initialBalance: string;
   initialBalanceDate: string | null;
   notes: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function reactivateBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   teamId: string;
   name: string;
   type: "cash" | "checking" | "investment" | "payment" | "savings";
   status: "active" | "archived";
   color: string;
   iconUrl: string | null;
   bankCode: string | null;
   bankName: string | null;
   branch: string | null;
   accountNumber: string | null;
   initialBalance: string;
   initialBalanceDate: string | null;
   notes: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteBankAccount(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function computeBankAccountBalance(
   db: DatabaseInstance,
   accountId: string,
   initialBalance: string,
): Promise<{
   currentBalance: string;
   projectedBalance: string;
}>;
export declare function listBankAccountsWithBalance(
   db: DatabaseInstance,
   teamId: string,
   includeArchived?: boolean,
): Promise<
   {
      currentBalance: string;
      projectedBalance: string;
      accountNumber: string | null;
      bankCode: string | null;
      bankName: string | null;
      branch: string | null;
      color: string;
      createdAt: Date;
      iconUrl: string | null;
      id: string;
      initialBalance: string;
      initialBalanceDate: string | null;
      name: string;
      notes: string | null;
      status: "active" | "archived";
      teamId: string;
      type: "cash" | "checking" | "investment" | "payment" | "savings";
      updatedAt: Date;
   }[]
>;
export declare function bankAccountHasTransactions(
   db: DatabaseInstance,
   accountId: string,
): Promise<boolean>;
//# sourceMappingURL=bank-accounts-repository.d.ts.map
