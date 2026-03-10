import { AppError, propagateError } from "@core/utils/errors";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import type {
   Bill,
   NewBill,
   NewRecurrenceSetting,
   RecurrenceSetting,
} from "../schemas/bills";
import { bills, recurrenceSettings } from "../schemas/bills";

export async function createBill(
   db: DatabaseInstance,
   data: NewBill,
): Promise<Bill> {
   try {
      const [bill] = await db.insert(bills).values(data).returning();
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
   data: NewRecurrenceSetting,
): Promise<RecurrenceSetting> {
   try {
      const [setting] = await db
         .insert(recurrenceSettings)
         .values(data)
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

// "overdue" is not stored — computed: pending + dueDate < today
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

      const today = new Date().toISOString().substring(0, 10);
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
         const end = new Date(year, month, 0).toISOString().substring(0, 10);
         conditions.push(gte(bills.dueDate, start));
         conditions.push(lte(bills.dueDate, end));
      }

      const whereClause = and(...conditions);
      const offset = (page - 1) * pageSize;

      const rows = await db.query.bills.findMany({
         where: { RAW: whereClause },
         with: { bankAccount: true, category: true },
         orderBy: { dueDate: "desc" },
         limit: pageSize,
         offset,
      });

      const [countResult] = await db
         .select({ total: count() })
         .from(bills)
         .where(whereClause);

      return { items: rows, total: countResult?.total ?? 0, page, pageSize };
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
         where: { id },
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
   data: Partial<NewBill>,
): Promise<Bill> {
   try {
      const [updated] = await db
         .update(bills)
         .set({ ...data, updatedAt: new Date() })
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
      const today = new Date().toISOString().substring(0, 10);
      return await db.query.recurrenceSettings.findMany({
         where: {
            RAW: sql`(${recurrenceSettings.endsAt} IS NULL OR ${recurrenceSettings.endsAt} >= ${today})`,
         },
      });
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
         where: { recurrenceGroupId },
         orderBy: { dueDate: "desc" },
      });
      return result ?? undefined;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get last bill for recurrence group");
   }
}
