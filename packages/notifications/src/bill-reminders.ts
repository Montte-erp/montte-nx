import type { DatabaseInstance } from "@packages/database/client";
import {
   type BillWithRelations,
   findOverdueBillsByOrganizationId,
   findPendingBillsByOrganizationId,
} from "@packages/database/repositories/bill-repository";
import { formatDecimalCurrency } from "@packages/money";
import { shouldSendNotification } from "@packages/database/repositories/notification-preferences-repository";
import { createNotificationPayload, sendPushNotificationToUser } from "./push";

interface BillReminderConfig {
   db: DatabaseInstance;
   organizationId: string;
   userId: string;
   vapidPublicKey?: string;
   vapidPrivateKey?: string;
   vapidSubject?: string;
   reminderDaysBefore?: number;
}

export interface ReminderResult {
   type: "upcoming" | "overdue";
   billsCount: number;
   totalAmount: number;
   notificationSent: boolean;
}

export async function checkBillReminders(
   config: BillReminderConfig,
): Promise<ReminderResult[]> {
   const {
      db,
      organizationId,
      userId,
      vapidPublicKey,
      vapidPrivateKey,
      vapidSubject,
      reminderDaysBefore = 3,
   } = config;

   if (!vapidPublicKey || !vapidPrivateKey) {
      return [];
   }

   const results: ReminderResult[] = [];

   const shouldNotifyReminders = await shouldSendNotification(
      db,
      userId,
      "billReminders",
   );
   const shouldNotifyOverdue = await shouldSendNotification(
      db,
      userId,
      "overdueAlerts",
   );

   if (shouldNotifyReminders) {
      const pendingBills = await findPendingBillsByOrganizationId(
         db,
         organizationId,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const reminderDate = new Date(today);
      reminderDate.setDate(reminderDate.getDate() + reminderDaysBefore);

      const upcomingBills = pendingBills.filter((bill: BillWithRelations) => {
         const dueDate = new Date(bill.dueDate);
         dueDate.setHours(0, 0, 0, 0);
         return dueDate >= today && dueDate <= reminderDate;
      });

      if (upcomingBills.length > 0) {
         const totalAmount = upcomingBills.reduce(
            (sum: number, bill: BillWithRelations) =>
               sum + Math.abs(Number(bill.amount)),
            0,
         );

         const payload = createNotificationPayload("bill_reminder", {
            body:
               upcomingBills.length === 1
                  ? `${upcomingBills[0]?.description || "Conta"} vence em breve - ${formatDecimalCurrency(totalAmount)}`
                  : `${upcomingBills.length} contas vencem nos próximos ${reminderDaysBefore} dias - Total: ${formatDecimalCurrency(totalAmount)}`,
            metadata: {
               billIds: upcomingBills.map((b: BillWithRelations) => b.id),
               count: upcomingBills.length,
               totalAmount,
            },
            title: "Contas a Vencer",
            url: "/bills?filter=pending",
         });

         const result = await sendPushNotificationToUser({
            db,
            payload,
            userId,
            vapidPrivateKey,
            vapidPublicKey,
            vapidSubject: vapidSubject || "mailto:admin@montte.co",
         });

         results.push({
            billsCount: upcomingBills.length,
            notificationSent: result.success,
            totalAmount,
            type: "upcoming",
         });
      }
   }

   if (shouldNotifyOverdue) {
      const overdueBills = await findOverdueBillsByOrganizationId(
         db,
         organizationId,
      );

      if (overdueBills.length > 0) {
         const totalAmount = overdueBills.reduce(
            (sum: number, bill: BillWithRelations) =>
               sum + Math.abs(Number(bill.amount)),
            0,
         );

         const payload = createNotificationPayload("overdue_alert", {
            body:
               overdueBills.length === 1
                  ? `${overdueBills[0]?.description || "Conta"} está vencida - ${formatDecimalCurrency(totalAmount)}`
                  : `${overdueBills.length} contas estão vencidas - Total: ${formatDecimalCurrency(totalAmount)}`,
            metadata: {
               billIds: overdueBills.map((b: BillWithRelations) => b.id),
               count: overdueBills.length,
               totalAmount,
            },
            title: "Contas Vencidas",
            url: "/bills?filter=overdue",
         });

         const result = await sendPushNotificationToUser({
            db,
            payload,
            userId,
            vapidPrivateKey,
            vapidPublicKey,
            vapidSubject: vapidSubject || "mailto:admin@montte.co",
         });

         results.push({
            billsCount: overdueBills.length,
            notificationSent: result.success,
            totalAmount,
            type: "overdue",
         });
      }
   }

   return results;
}
