import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateBillInput,
   type UpdateBillInput,
   type CreateRecurrenceSettingInput,
   type Bill,
   type NewBill,
   type RecurrenceSetting,
} from "@core/database/schemas/bills";
import type { ContactSubscription } from "@core/database/schemas/subscriptions";
import type { ServiceVariant } from "@core/database/schemas/services";
export declare function ensureBillOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<Bill>;
export declare function validateBillReferences(
   db: DatabaseInstance,
   teamId: string,
   refs: {
      bankAccountId?: string | null;
      categoryId?: string | null;
      contactId?: string | null;
   },
): Promise<void>;
export declare function createBill(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBillInput,
): Promise<Bill>;
export declare function createBillsBatch(
   db: DatabaseInstance,
   data: NewBill[],
): Promise<Bill[]>;
export declare function createRecurrenceSetting(
   db: DatabaseInstance,
   teamId: string,
   data: CreateRecurrenceSettingInput,
): Promise<RecurrenceSetting>;
export interface ListBillsOptions {
   teamId: string;
   type?: "payable" | "receivable";
   status?: "pending" | "paid" | "cancelled" | "overdue";
   categoryId?: string;
   month?: number;
   year?: number;
   page?: number;
   pageSize?: number;
}
export declare function listBills(
   db: DatabaseInstance,
   options: ListBillsOptions,
): Promise<{
   items: {
      id: string;
      teamId: string;
      name: string;
      description: string | null;
      type: "payable" | "receivable";
      status: "cancelled" | "paid" | "pending";
      amount: string;
      dueDate: string;
      paidAt: Date | null;
      bankAccountId: string | null;
      categoryId: string | null;
      attachmentUrl: string | null;
      installmentGroupId: string | null;
      installmentIndex: number | null;
      installmentTotal: number | null;
      recurrenceGroupId: string | null;
      transactionId: string | null;
      contactId: string | null;
      subscriptionId: string | null;
      createdAt: Date;
      updatedAt: Date;
      bankAccount: {
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
      } | null;
      category: {
         id: string;
         teamId: string;
         parentId: string | null;
         name: string;
         type: "expense" | "income";
         level: number;
         description: string | null;
         isDefault: boolean;
         color: string | null;
         icon: string | null;
         isArchived: boolean;
         keywords: string[] | null;
         notes: string | null;
         participatesDre: boolean;
         dreGroupId: string | null;
         createdAt: Date;
         updatedAt: Date;
      } | null;
   }[];
   total: number;
   page: number;
   pageSize: number;
}>;
export declare function getBill(
   db: DatabaseInstance,
   id: string,
): Promise<Bill | undefined>;
export declare function updateBill(
   db: DatabaseInstance,
   id: string,
   data: UpdateBillInput,
): Promise<Bill>;
export declare function deleteBill(
   db: DatabaseInstance,
   id: string,
): Promise<void>;
export declare function getActiveRecurrenceSettings(
   db: DatabaseInstance,
): Promise<RecurrenceSetting[]>;
export declare function getLastBillForRecurrenceGroup(
   db: DatabaseInstance,
   recurrenceGroupId: string,
): Promise<Bill | undefined>;
export declare function generateBillsForSubscription(
   db: DatabaseInstance,
   subscription: ContactSubscription,
   variant: ServiceVariant,
   serviceName: string,
): Promise<void>;
export declare function cancelPendingBillsForSubscription(
   db: DatabaseInstance,
   subscriptionId: string,
): Promise<void>;
//# sourceMappingURL=bills-repository.d.ts.map
