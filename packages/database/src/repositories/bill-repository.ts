import { createSearchTokens } from "@packages/encryption/search-index";
import {
   decryptBillFields,
   encryptBillFields,
   encryptTransactionFields,
} from "@packages/encryption/service";
import { serverEnv } from "@packages/environment/server";
import { centsToReais, reaisToCents } from "@packages/money";
import { calculateInstallmentDates } from "@packages/utils/date-math";
import { AppError, propagateError } from "@packages/utils/errors";
import { and, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import type { bankAccount } from "../schemas/bank-accounts";
import { bill } from "../schemas/bills";
import type { costCenter } from "../schemas/cost-centers";
import type { counterparty } from "../schemas/counterparties";
import type { interestTemplate } from "../schemas/interest-templates";
import { transaction } from "../schemas/transactions";

export type Bill = typeof bill.$inferSelect;
export type NewBill = typeof bill.$inferInsert;
export type BankAccount = typeof bankAccount.$inferSelect;
export type Transaction = typeof transaction.$inferSelect;
export type Counterparty = typeof counterparty.$inferSelect;
export type InterestTemplate = typeof interestTemplate.$inferSelect;
export type CostCenter = typeof costCenter.$inferSelect;

export type BillWithRelations = Bill & {
   bankAccount: BankAccount | null;
   costCenter: CostCenter | null;
   counterparty: Counterparty | null;
   interestTemplate: InterestTemplate | null;
   transaction: Transaction | null;
};

export async function createBill(dbClient: DatabaseInstance, data: NewBill) {
   try {
      // Encrypt sensitive fields before storing
      const encryptedData = encryptBillFields(data);

      const result = await dbClient
         .insert(bill)
         .values(encryptedData)
         .returning();

      const createdBillId = result[0]?.id;
      if (!createdBillId) {
         throw AppError.database("Failed to get created bill ID");
      }

      const createdBill = await dbClient.query.bill.findFirst({
         where: (bill, { eq }) => eq(bill.id, createdBillId),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });

      if (!createdBill) {
         throw AppError.database("Failed to fetch created bill");
      }

      // Decrypt sensitive fields before returning
      return decryptBillFields(createdBill);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create bill: ${(err as Error).message}`,
      );
   }
}

export async function findBillById(dbClient: DatabaseInstance, billId: string) {
   try {
      const result = await dbClient.query.bill.findFirst({
         where: (bill, { eq }) => eq(bill.id, billId),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result ? decryptBillFields(result) : result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bill by id: ${(err as Error).message}`,
      );
   }
}

export async function findBillByTransactionId(
   dbClient: DatabaseInstance,
   transactionId: string,
) {
   try {
      const result = await dbClient.query.bill.findFirst({
         where: (bill, { eq }) => eq(bill.transactionId, transactionId),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result ? decryptBillFields(result) : result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bill by transaction id: ${(err as Error).message}`,
      );
   }
}

export async function findBillsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { desc }) => desc(bill.dueDate),
         where: (bill, { eq }) => eq(bill.organizationId, organizationId),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bills by organization id: ${(err as Error).message}`,
      );
   }
}

export async function findBillsByOrganizationIdFiltered(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      type?: "income" | "expense";
      month?: string;
      orderBy?: "dueDate" | "issueDate" | "amount" | "createdAt";
      orderDirection?: "asc" | "desc";
   } = {},
) {
   const {
      type,
      month,
      orderBy = "dueDate",
      orderDirection = "desc",
   } = options;

   try {
      const buildWhereCondition = () => {
         const conditions = [eq(bill.organizationId, organizationId)];

         if (type) {
            conditions.push(eq(bill.type, type));
         }

         if (month) {
            const [year, monthNum] = month.split("-").map(Number);
            if (year && monthNum) {
               const monthStart = new Date(year, monthNum - 1, 1);
               const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
               conditions.push(gte(bill.dueDate, monthStart));
               conditions.push(lte(bill.dueDate, monthEnd));
            }
         }

         return and(...conditions);
      };

      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { asc, desc }) => {
            const column = bill[orderBy as keyof typeof bill];
            return orderDirection === "asc" ? asc(column) : desc(column);
         },
         where: buildWhereCondition,
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });

      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bills by organization id with filters: ${(err as Error).message}`,
      );
   }
}

export async function findBillsByOrganizationIdPaginated(
   dbClient: DatabaseInstance,
   organizationId: string,
   options: {
      page?: number;
      limit?: number;
      type?: "income" | "expense";
      month?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      orderBy?: "dueDate" | "issueDate" | "amount" | "createdAt";
      orderDirection?: "asc" | "desc";
   } = {},
) {
   const {
      page = 1,
      limit = 10,
      type,
      month,
      startDate,
      endDate,
      search,
      orderBy = "dueDate",
      orderDirection = "desc",
   } = options;

   const offset = (page - 1) * limit;

   try {
      const buildWhereCondition = () => {
         const conditions = [eq(bill.organizationId, organizationId)];

         if (type) {
            conditions.push(eq(bill.type, type));
         }

         if (search) {
            const searchKey = serverEnv.SEARCH_KEY;
            if (searchKey) {
               // Use blind index search with HMAC tokens
               const tokens = createSearchTokens(search, searchKey);
               if (tokens.length > 0) {
                  const tokenConditions = tokens.map((token) =>
                     ilike(bill.searchIndex, `%${token}%`),
                  );
                  conditions.push(or(...tokenConditions)!);
               }
            }
            // If no SEARCH_KEY, search is silently skipped (search index not available)
         }

         if (startDate) {
            conditions.push(gte(bill.dueDate, startDate));
         }

         if (endDate) {
            conditions.push(lte(bill.dueDate, endDate));
         }

         if (month && !startDate && !endDate) {
            const [year, monthNum] = month.split("-").map(Number);
            if (year && monthNum) {
               const monthStart = new Date(year, monthNum - 1, 1);
               const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
               conditions.push(gte(bill.dueDate, monthStart));
               conditions.push(lte(bill.dueDate, monthEnd));
            }
         }

         return and(...conditions);
      };

      const [bills, totalCount] = await Promise.all([
         dbClient.query.bill.findMany({
            limit,
            offset,
            orderBy: (bill, { asc, desc }) => {
               const column = bill[orderBy as keyof typeof bill];
               return orderDirection === "asc" ? asc(column) : desc(column);
            },
            where: buildWhereCondition,
            with: {
               bankAccount: true,
               costCenter: true,
               counterparty: true,
               interestTemplate: true,
               transaction: true,
            },
         }),
         dbClient.query.bill
            .findMany({
               where: buildWhereCondition,
            })
            .then((result) => result.length),
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
         // Decrypt sensitive fields before returning
         bills: bills.map(decryptBillFields),
         pagination: {
            currentPage: page,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            limit,
            totalCount,
            totalPages,
         },
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bills by organization id paginated: ${(err as Error).message}`,
      );
   }
}

export async function findBillsByOrganizationIdAndType(
   dbClient: DatabaseInstance,
   organizationId: string,
   type: "income" | "expense",
) {
   try {
      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { desc }) => desc(bill.dueDate),
         where: (bill, { eq, and }) =>
            and(eq(bill.organizationId, organizationId), eq(bill.type, type)),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bills by organization id and type: ${(err as Error).message}`,
      );
   }
}

export async function findPendingBillsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { desc }) => desc(bill.dueDate),
         where: (bill, { eq, and, gte, isNull }) =>
            and(
               eq(bill.organizationId, organizationId),
               gte(bill.dueDate, today),
               isNull(bill.completionDate),
            ),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find pending bills: ${(err as Error).message}`,
      );
   }
}

export async function findOverdueBillsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { desc }) => desc(bill.dueDate),
         where: (bill, { eq, and, lt, isNull }) =>
            and(
               eq(bill.organizationId, organizationId),
               lt(bill.dueDate, today),
               isNull(bill.completionDate),
            ),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find overdue bills: ${(err as Error).message}`,
      );
   }
}

export async function findCompletedBillsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { desc }) => desc(bill.completionDate),
         where: (bill, { eq, and, isNotNull }) =>
            and(
               eq(bill.organizationId, organizationId),
               isNotNull(bill.completionDate),
            ),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find completed bills: ${(err as Error).message}`,
      );
   }
}

export async function updateBill(
   dbClient: DatabaseInstance,
   billId: string,
   data: Partial<NewBill>,
) {
   try {
      // Encrypt sensitive fields before storing
      const encryptedData = encryptBillFields(data);

      const result = await dbClient
         .update(bill)
         .set(encryptedData)
         .where(eq(bill.id, billId))
         .returning();

      if (!result.length) {
         throw AppError.database("Bill not found");
      }

      const updatedBill = await dbClient.query.bill.findFirst({
         where: (bill, { eq }) => eq(bill.id, billId),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });

      if (!updatedBill) {
         throw AppError.database("Failed to fetch updated bill");
      }

      // Decrypt sensitive fields before returning
      return decryptBillFields(updatedBill);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update bill: ${(err as Error).message}`,
      );
   }
}

export async function deleteBill(dbClient: DatabaseInstance, billId: string) {
   try {
      const result = await dbClient
         .delete(bill)
         .where(eq(bill.id, billId))
         .returning();

      if (!result.length) {
         throw AppError.database("Bill not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete bill: ${(err as Error).message}`,
      );
   }
}

export async function getTotalBillsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient
         .select({ count: sql<number>`count(*)` })
         .from(bill)
         .where(eq(bill.organizationId, organizationId));

      return result[0]?.count || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total bills count: ${(err as Error).message}`,
      );
   }
}

export async function getTotalPendingPayablesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient
         .select({
            total: sql<number>`sum(CASE WHEN ${bill.type} = 'expense' AND ${bill.completionDate} IS NULL THEN CAST(${bill.amount} AS REAL) ELSE 0 END)`,
         })
         .from(bill)
         .where(eq(bill.organizationId, organizationId));

      return result[0]?.total || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total pending payables: ${(err as Error).message}`,
      );
   }
}

export async function getTotalPendingReceivablesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const result = await dbClient
         .select({
            total: sql<number>`sum(CASE WHEN ${bill.type} = 'income' AND ${bill.completionDate} IS NULL THEN CAST(${bill.amount} AS REAL) ELSE 0 END)`,
         })
         .from(bill)
         .where(eq(bill.organizationId, organizationId));

      return result[0]?.total || 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total pending receivables: ${(err as Error).message}`,
      );
   }
}

export async function getTotalOverdueBillsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await dbClient.query.bill.findMany({
         where: (bill, { eq, and, lt, isNull }) =>
            and(
               eq(bill.organizationId, organizationId),
               lt(bill.dueDate, today),
               isNull(bill.completionDate),
            ),
      });

      return result.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total overdue bills count: ${(err as Error).message}`,
      );
   }
}

export async function getTotalOverduePayablesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await dbClient.query.bill.findMany({
         where: (bill, { eq, and, lt, isNull }) =>
            and(
               eq(bill.organizationId, organizationId),
               eq(bill.type, "expense"),
               lt(bill.dueDate, today),
               isNull(bill.completionDate),
            ),
      });

      return result.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total overdue payables count: ${(err as Error).message}`,
      );
   }
}

export async function getTotalOverdueReceivablesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await dbClient.query.bill.findMany({
         where: (bill, { eq, and, lt, isNull }) =>
            and(
               eq(bill.organizationId, organizationId),
               eq(bill.type, "income"),
               lt(bill.dueDate, today),
               isNull(bill.completionDate),
            ),
      });

      return result.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get total overdue receivables count: ${(err as Error).message}`,
      );
   }
}

export async function deleteManyBills(
   dbClient: DatabaseInstance,
   billIds: string[],
   organizationId: string,
) {
   try {
      if (billIds.length === 0) {
         return { deletedCount: 0 };
      }

      const billsToDelete = await dbClient.query.bill.findMany({
         where: (bill, { and, eq, inArray }) =>
            and(
               eq(bill.organizationId, organizationId),
               inArray(bill.id, billIds),
            ),
      });

      const completedBills = billsToDelete.filter((b) => b.completionDate);
      if (completedBills.length > 0) {
         throw AppError.validation(
            "Cannot delete completed bills. Delete the associated transactions first.",
         );
      }

      const validIds = billsToDelete.map((b) => b.id);
      if (validIds.length === 0) {
         return { deletedCount: 0 };
      }

      const result = await dbClient
         .delete(bill)
         .where(
            and(
               eq(bill.organizationId, organizationId),
               sql`${bill.id} IN ${validIds}`,
            ),
         )
         .returning();

      return { deletedCount: result.length };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete multiple bills: ${(err as Error).message}`,
      );
   }
}

export async function completeManyBills(
   dbClient: DatabaseInstance,
   billIds: string[],
   organizationId: string,
   completionDate: Date,
) {
   try {
      if (billIds.length === 0) {
         return { completedCount: 0, transactionIds: [] as string[] };
      }

      const billsToComplete = await dbClient.query.bill.findMany({
         where: (bill, { and, eq, isNull, inArray }) =>
            and(
               eq(bill.organizationId, organizationId),
               inArray(bill.id, billIds),
               isNull(bill.completionDate),
            ),
         with: {
            bankAccount: true,
         },
      });

      if (billsToComplete.length === 0) {
         return { completedCount: 0, transactionIds: [] as string[] };
      }

      const transactionIds: string[] = [];

      for (const billItem of billsToComplete) {
         const transactionId = crypto.randomUUID();
         transactionIds.push(transactionId);

         await dbClient.transaction(async (tx) => {
            const transactionData = encryptTransactionFields({
               amount: billItem.amount,
               bankAccountId: billItem.bankAccountId,
               date: completionDate,
               description: billItem.description,
               id: transactionId,
               organizationId,
               type: billItem.type as "income" | "expense",
            });
            await tx.insert(transaction).values(transactionData);

            await tx
               .update(bill)
               .set({
                  completionDate,
                  transactionId,
               })
               .where(eq(bill.id, billItem.id));
         });
      }

      return { completedCount: billsToComplete.length, transactionIds };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to complete multiple bills: ${(err as Error).message}`,
      );
   }
}

export type BillCompletionItem = {
   billId: string;
   completionDate: Date;
};

export async function completeManyBillsWithDates(
   dbClient: DatabaseInstance,
   items: BillCompletionItem[],
   organizationId: string,
) {
   try {
      if (items.length === 0) {
         return { completedCount: 0, transactionIds: [] as string[] };
      }

      const billIds = items.map((item) => item.billId);
      const datesByBillId = new Map(
         items.map((item) => [item.billId, item.completionDate]),
      );

      const billsToComplete = await dbClient.query.bill.findMany({
         where: (bill, { and, eq, isNull, inArray }) =>
            and(
               eq(bill.organizationId, organizationId),
               inArray(bill.id, billIds),
               isNull(bill.completionDate),
            ),
         with: {
            bankAccount: true,
         },
      });

      if (billsToComplete.length === 0) {
         return { completedCount: 0, transactionIds: [] as string[] };
      }

      const transactionIds: string[] = [];

      for (const billItem of billsToComplete) {
         const completionDate = datesByBillId.get(billItem.id);
         if (!completionDate) continue;

         const transactionId = crypto.randomUUID();
         transactionIds.push(transactionId);

         await dbClient.transaction(async (tx) => {
            const transactionData = encryptTransactionFields({
               amount: billItem.amount,
               bankAccountId: billItem.bankAccountId,
               date: completionDate,
               description: billItem.description,
               id: transactionId,
               organizationId,
               type: billItem.type as "income" | "expense",
            });
            await tx.insert(transaction).values(transactionData);

            await tx
               .update(bill)
               .set({
                  completionDate,
                  transactionId,
               })
               .where(eq(bill.id, billItem.id));
         });
      }

      return { completedCount: billsToComplete.length, transactionIds };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to complete multiple bills with dates: ${(err as Error).message}`,
      );
   }
}

export async function findBillsByInstallmentGroupId(
   dbClient: DatabaseInstance,
   installmentGroupId: string,
) {
   try {
      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { asc }) => asc(bill.installmentNumber),
         where: (bill, { eq }) =>
            eq(bill.installmentGroupId, installmentGroupId),
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });
      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bills by installment group id: ${(err as Error).message}`,
      );
   }
}

export async function updateBillInterest(
   dbClient: DatabaseInstance,
   billId: string,
   data: {
      appliedPenalty?: string;
      appliedInterest?: string;
      appliedCorrection?: string;
      lastInterestUpdate?: Date;
   },
) {
   try {
      const result = await dbClient
         .update(bill)
         .set(data)
         .where(eq(bill.id, billId))
         .returning();

      if (!result.length) {
         throw AppError.database("Bill not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update bill interest: ${(err as Error).message}`,
      );
   }
}

export type InstallmentConfig = {
   totalInstallments: number;
   intervalDays: number;
   amounts: number[] | "equal";
};

export type CreateBillWithInstallmentsInput = Omit<
   NewBill,
   | "installmentGroupId"
   | "installmentNumber"
   | "totalInstallments"
   | "installmentIntervalDays"
> & {
   installments: InstallmentConfig;
};

export async function createBillWithInstallments(
   dbClient: DatabaseInstance,
   data: CreateBillWithInstallmentsInput,
) {
   try {
      const { installments, ...billData } = data;
      const { totalInstallments, intervalDays, amounts } = installments;

      const installmentGroupId = crypto.randomUUID();
      const baseAmount = Number(billData.amount);
      const baseDueDate = new Date(billData.dueDate);

      // Use integer math in cents to avoid floating-point precision issues
      let installmentAmounts: number[];
      if (amounts === "equal") {
         const totalCents = reaisToCents(baseAmount);
         const baseCents = Math.floor(totalCents / totalInstallments);
         const remainder = totalCents % totalInstallments;

         installmentAmounts = Array.from(
            { length: totalInstallments },
            (_, i) => {
               const cents = baseCents + (i < remainder ? 1 : 0);
               return centsToReais(cents);
            },
         );
      } else {
         installmentAmounts = amounts;
      }

      if (installmentAmounts.length !== totalInstallments) {
         throw AppError.validation(
            "Number of amounts must match total installments",
         );
      }

      const createdBills: BillWithRelations[] = [];

      // Calculate all installment dates upfront, preserving day-of-month for monthly intervals
      const installmentDates = calculateInstallmentDates(
         baseDueDate,
         totalInstallments,
         intervalDays,
      );

      await dbClient.transaction(async (tx) => {
         for (let i = 0; i < totalInstallments; i++) {
            const installmentDueDate = installmentDates[i] as Date;
            const installmentAmount = installmentAmounts[i] as number;
            const billId = crypto.randomUUID();

            const installmentData = encryptBillFields({
               ...billData,
               amount: String(installmentAmount),
               dueDate: installmentDueDate,
               id: billId,
               installmentGroupId,
               installmentIntervalDays: intervalDays,
               installmentNumber: i + 1,
               originalAmount: String(installmentAmount),
               totalInstallments,
            });
            await tx.insert(bill).values(installmentData);

            const createdBill = await tx.query.bill.findFirst({
               where: (bill, { eq }) => eq(bill.id, billId),
               with: {
                  bankAccount: true,
                  costCenter: true,
                  counterparty: true,
                  interestTemplate: true,
                  transaction: true,
               },
            });

            if (createdBill) {
               createdBills.push(createdBill);
            }
         }
      });

      return {
         bills: createdBills.map(decryptBillFields),
         installmentGroupId,
         totalInstallments,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create bill with installments: ${(err as Error).message}`,
      );
   }
}

export type FindBillsDueWithinDaysOptions = {
   type?: "income" | "expense";
   includeOverdue?: boolean;
};

/**
 * Find bills due within a specified number of days.
 * Used for bills digest emails.
 */
export async function findBillsDueWithinDays(
   dbClient: DatabaseInstance,
   organizationId: string,
   daysAhead: number,
   options: FindBillsDueWithinDaysOptions = {},
): Promise<BillWithRelations[]> {
   const { type, includeOverdue = false } = options;

   try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + daysAhead);
      futureDate.setHours(23, 59, 59, 999);

      const buildWhereCondition = () => {
         const conditions = [eq(bill.organizationId, organizationId)];

         // Only include non-completed bills
         conditions.push(sql`${bill.completionDate} IS NULL`);

         if (type) {
            conditions.push(eq(bill.type, type));
         }

         // Date range condition
         if (includeOverdue) {
            // Include all bills up to futureDate (overdue + pending)
            conditions.push(lte(bill.dueDate, futureDate));
         } else {
            // Only pending bills: from today to futureDate
            conditions.push(gte(bill.dueDate, today));
            conditions.push(lte(bill.dueDate, futureDate));
         }

         return and(...conditions);
      };

      const result = await dbClient.query.bill.findMany({
         orderBy: (bill, { asc }) => asc(bill.dueDate),
         where: buildWhereCondition,
         with: {
            bankAccount: true,
            costCenter: true,
            counterparty: true,
            interestTemplate: true,
            transaction: true,
         },
      });

      // Decrypt sensitive fields before returning
      return result.map(decryptBillFields);
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find bills due within days: ${(err as Error).message}`,
      );
   }
}
