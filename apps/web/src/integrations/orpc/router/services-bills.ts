import type { DatabaseInstance } from "@core/database/client";
import { bills } from "@core/database/schemas/bills";
import type { ContactSubscription } from "@core/database/schemas/subscriptions";
import type { ServiceVariant } from "@core/database/schemas/services";
import { and, eq } from "drizzle-orm";

/**
 * Auto-generate receivable bills for a subscription.
 * - monthly: one bill per month in [startDate, endDate]
 * - annual: one bill
 * - one_time: one bill
 * - hourly: no auto-generation (too granular, created manually per session)
 */
export async function generateBillsForSubscription(
   db: DatabaseInstance,
   subscription: ContactSubscription,
   variant: ServiceVariant,
   serviceName: string,
): Promise<void> {
   const { billingCycle } = variant;
   if (billingCycle === "hourly") return;

   const amount = subscription.negotiatedPrice;
   const start = new Date(subscription.startDate);
   const end = subscription.endDate ? new Date(subscription.endDate) : null;

   const formatMonthYear = (d: Date) => {
      const month = d
         .toLocaleDateString("pt-BR", { month: "short" })
         .replace(".", "")
         .replace(/^\w/, (c) => c.toUpperCase());
      return `${month}/${d.getFullYear()}`;
   };

   const makeBill = (dueDate: Date, label: string) => ({
      teamId: subscription.teamId,
      name: `${serviceName} – ${variant.name}`,
      description: `${serviceName} – ${variant.name} (${label})`,
      type: "receivable" as const,
      amount,
      dueDate: dueDate.toISOString().slice(0, 10),
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
      const cursor = new Date(start);
      const limit =
         end ??
         (() => {
            const d = new Date(start);
            d.setFullYear(d.getFullYear() + 2);
            return d;
         })();
      while (cursor <= limit) {
         billsToCreate.push(
            makeBill(new Date(cursor), formatMonthYear(cursor)),
         );
         cursor.setMonth(cursor.getMonth() + 1);
      }
   }

   if (billsToCreate.length === 0) return;
   await db.insert(bills).values(billsToCreate);
}

/**
 * Cancel all pending bills for a subscription.
 */
export async function cancelPendingBillsForSubscription(
   db: DatabaseInstance,
   subscriptionId: string,
): Promise<void> {
   await db
      .update(bills)
      .set({ status: "cancelled" })
      .where(
         and(
            eq(bills.subscriptionId, subscriptionId),
            eq(bills.status, "pending"),
         ),
      );
}
