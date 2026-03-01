import type { DatabaseInstance } from "@packages/database/client";
import {
   createBillsBatch,
   getActiveRecurrenceSettings,
   getLastBillForRecurrenceGroup,
} from "@packages/database/repositories/bills-repository";

function computeNextDueDate(from: string, frequency: string): string {
   const d = new Date(from);
   switch (frequency) {
      case "weekly":    d.setDate(d.getDate() + 7); break;
      case "biweekly":  d.setDate(d.getDate() + 14); break;
      case "monthly":   d.setMonth(d.getMonth() + 1); break;
      case "quarterly": d.setMonth(d.getMonth() + 3); break;
      case "yearly":    d.setFullYear(d.getFullYear() + 1); break;
   }
   return d.toISOString().substring(0, 10);
}

export async function generateBillOccurrences(db: DatabaseInstance): Promise<void> {
   const settings = await getActiveRecurrenceSettings(db);

   for (const setting of settings) {
      const lastBill = await getLastBillForRecurrenceGroup(db, setting.id);
      if (!lastBill) continue;

      const today = new Date();
      const windowEnd = new Date(today);
      windowEnd.setMonth(windowEnd.getMonth() + setting.windowMonths);

      const toCreate = [];
      let nextDue = computeNextDueDate(lastBill.dueDate, setting.frequency);

      while (new Date(nextDue) <= windowEnd) {
         if (setting.endsAt && new Date(nextDue) > new Date(setting.endsAt)) break;

         toCreate.push({
            teamId: lastBill.teamId,
            name: lastBill.name,
            description: lastBill.description,
            type: lastBill.type,
            amount: lastBill.amount,
            dueDate: nextDue,
            bankAccountId: lastBill.bankAccountId,
            categoryId: lastBill.categoryId,
            recurrenceGroupId: setting.id,
         });

         nextDue = computeNextDueDate(nextDue, setting.frequency);
      }

      if (toCreate.length > 0) {
         await createBillsBatch(db, toCreate);
         console.log(
            `[BillRecurrence] Created ${toCreate.length} occurrences for group ${setting.id}`,
         );
      }
   }
}
