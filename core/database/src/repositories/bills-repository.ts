import dayjs from "dayjs";
import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, count, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateBillInput,
   type UpdateBillInput,
   type CreateRecurrenceSettingInput,
   type Bill,
   type NewBill,
   type RecurrenceSetting,
   bills,
   recurrenceSettings,
   createBillSchema,
   updateBillSchema,
   createRecurrenceSettingSchema,
} from "@core/database/schemas/bills";
import type { ContactSubscription } from "@core/database/schemas/subscriptions";
import type { ServiceVariant } from "@core/database/schemas/services";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { categories } from "@core/database/schemas/categories";
import { getBankAccount } from "@core/database/repositories/bank-accounts-repository";
import { getCategory } from "@core/database/repositories/categories-repository";
import { getContact } from "@core/database/repositories/contacts-repository";

export async function ensureBillOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<Bill> {
   const bill = await getBill(db, id);
   if (!bill || bill.teamId !== teamId) {
      throw AppError.notFound("Conta a pagar/receber não encontrada.");
   }
   return bill;
}

export async function validateBillReferences(
   db: DatabaseInstance,
   teamId: string,
   refs: {
      bankAccountId?: string | null;
      categoryId?: string | null;
      contactId?: string | null;
   },
): Promise<void> {
   if (refs.bankAccountId) {
      const account = await getBankAccount(db, refs.bankAccountId);
      if (!account || account.teamId !== teamId) {
         throw AppError.validation("Conta bancária inválida.");
      }
   }

   if (refs.categoryId) {
      const catResult = await getCategory(db, refs.categoryId);
      if (catResult.isErr()) throw catResult.error;
      const cat = catResult.value;
      if (!cat || cat.teamId !== teamId) {
         throw AppError.validation("Categoria inválida.");
      }
   }

   if (refs.contactId) {
      const contact = await getContact(db, refs.contactId);
      if (!contact || contact.teamId !== teamId) {
         throw AppError.validation("Contato inválido.");
      }
   }
}

export async function createBill(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBillInput,
): Promise<Bill> {
   try {
      const validated = validateInput(createBillSchema, data);
      const [bill] = await db
         .insert(bills)
         .values({ ...validated, teamId })
         .returning();
      if (!bill) throw AppError.database("Failed to create bill");
      return bill;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bill");
   }
}

export async function createBillsBatch(
   db: DatabaseInstance,
   data: NewBill[],
): Promise<Bill[]> {
   try {
      return await db.insert(bills).values(data).returning();
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create bills batch");
   }
}

export async function createRecurrenceSetting(
   db: DatabaseInstance,
   teamId: string,
   data: CreateRecurrenceSettingInput,
): Promise<RecurrenceSetting> {
   try {
      const validated = validateInput(createRecurrenceSettingSchema, data);
      const [setting] = await db
         .insert(recurrenceSettings)
         .values({ ...validated, teamId })
         .returning();
      if (!setting)
         throw AppError.database("Failed to create recurrence setting");
      return setting;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create recurrence setting");
   }
}

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

export async function listBills(
   db: DatabaseInstance,
   options: ListBillsOptions,
) {
   try {
      const {
         teamId,
         type,
         status,
         categoryId,
         month,
         year,
         page = 1,
         pageSize = 20,
      } = options;

      const today = dayjs().format("YYYY-MM-DD");
      const conditions = [eq(bills.teamId, teamId)];

      if (type) conditions.push(eq(bills.type, type));

      if (status === "overdue") {
         conditions.push(eq(bills.status, "pending"));
         conditions.push(lte(bills.dueDate, today));
      } else if (status === "pending") {
         conditions.push(eq(bills.status, "pending"));
         conditions.push(gte(bills.dueDate, today));
      } else if (status) {
         conditions.push(eq(bills.status, status));
      }

      if (categoryId) conditions.push(eq(bills.categoryId, categoryId));

      if (month && year) {
         const start = `${year}-${String(month).padStart(2, "0")}-01`;
         const end = dayjs(start).endOf("month").format("YYYY-MM-DD");
         conditions.push(gte(bills.dueDate, start));
         conditions.push(lte(bills.dueDate, end));
      }

      const whereClause = and(...conditions);
      const offset = (page - 1) * pageSize;

      const rows = await db
         .select({
            bill: bills,
            bankAccount: bankAccounts,
            category: categories,
         })
         .from(bills)
         .leftJoin(bankAccounts, eq(bills.bankAccountId, bankAccounts.id))
         .leftJoin(categories, eq(bills.categoryId, categories.id))
         .where(whereClause)
         .orderBy(sql`${bills.dueDate} desc`)
         .limit(pageSize)
         .offset(offset);

      const items = rows.map((row) => ({
         ...row.bill,
         bankAccount: row.bankAccount,
         category: row.category,
      }));

      const [countResult] = await db
         .select({ total: count() })
         .from(bills)
         .where(whereClause);

      return { items, total: countResult?.total ?? 0, page, pageSize };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list bills");
   }
}

export async function getBill(
   db: DatabaseInstance,
   id: string,
): Promise<Bill | undefined> {
   try {
      const result = await db.query.bills.findFirst({
         where: (fields, { eq }) => eq(fields.id, id),
         with: { bankAccount: true, category: true, transaction: true },
      });
      return result ?? undefined;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get bill");
   }
}

export async function updateBill(
   db: DatabaseInstance,
   id: string,
   data: UpdateBillInput,
): Promise<Bill> {
   try {
      const validated = validateInput(updateBillSchema, data);
      const [updated] = await db
         .update(bills)
         .set({ ...validated, updatedAt: dayjs().toDate() })
         .where(eq(bills.id, id))
         .returning();
      if (!updated) throw AppError.database("Bill not found");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update bill");
   }
}

export async function deleteBill(
   db: DatabaseInstance,
   id: string,
): Promise<void> {
   try {
      await db.delete(bills).where(eq(bills.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete bill");
   }
}

export async function getActiveRecurrenceSettings(
   db: DatabaseInstance,
): Promise<RecurrenceSetting[]> {
   try {
      const today = dayjs().format("YYYY-MM-DD");
      return await db
         .select()
         .from(recurrenceSettings)
         .where(
            or(
               isNull(recurrenceSettings.endsAt),
               gte(recurrenceSettings.endsAt, today),
            ),
         );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get recurrence settings");
   }
}

export async function getLastBillForRecurrenceGroup(
   db: DatabaseInstance,
   recurrenceGroupId: string,
): Promise<Bill | undefined> {
   try {
      const result = await db.query.bills.findFirst({
         where: (fields, { eq }) =>
            eq(fields.recurrenceGroupId, recurrenceGroupId),
         orderBy: (fields, { desc }) => [desc(fields.dueDate)],
      });
      return result ?? undefined;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get last bill for recurrence group");
   }
}

export async function generateBillsForSubscription(
   db: DatabaseInstance,
   subscription: ContactSubscription,
   variant: ServiceVariant,
   serviceName: string,
): Promise<void> {
   const { billingCycle } = variant;
   if (billingCycle === "hourly") return;

   const amount = subscription.negotiatedPrice;
   const start = dayjs(subscription.startDate);
   const end = subscription.endDate ? dayjs(subscription.endDate) : null;

   const formatMonthYear = (d: typeof start) => {
      const month = new Intl.DateTimeFormat("pt-BR", { month: "short" })
         .format(d.toDate())
         .replace(".", "")
         .replace(/^\w/, (c) => c.toUpperCase());
      return `${month}/${d.year()}`;
   };

   const makeBill = (dueDate: typeof start, label: string) => ({
      teamId: subscription.teamId,
      name: `${serviceName} – ${variant.name}`,
      description: `${serviceName} – ${variant.name} (${label})`,
      type: "receivable" as const,
      amount,
      dueDate: dueDate.format("YYYY-MM-DD"),
      contactId: subscription.contactId,
      subscriptionId: subscription.id,
      status: "pending" as const,
   });

   const billsToCreate = [];

   if (billingCycle === "one_time") {
      billsToCreate.push(makeBill(start, "Pagamento único"));
   } else if (billingCycle === "annual") {
      billsToCreate.push(makeBill(start, formatMonthYear(start)));
   } else if (billingCycle === "monthly") {
      const twoYearLimit = start.add(2, "year");
      const limit = end ?? twoYearLimit;
      const inclusive = end !== null;
      let cursor = start;
      while (inclusive ? !cursor.isAfter(limit) : cursor.isBefore(limit)) {
         billsToCreate.push(makeBill(cursor, formatMonthYear(cursor)));
         cursor = cursor.add(1, "month");
      }
   }

   if (billsToCreate.length === 0) return;

   try {
      await db.insert(bills).values(billsToCreate);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao gerar cobranças da assinatura.");
   }
}

export async function cancelPendingBillsForSubscription(
   db: DatabaseInstance,
   subscriptionId: string,
): Promise<void> {
   try {
      await db
         .update(bills)
         .set({ status: "cancelled" })
         .where(
            and(
               eq(bills.subscriptionId, subscriptionId),
               eq(bills.status, "pending"),
            ),
         );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Falha ao cancelar cobranças pendentes.");
   }
}
