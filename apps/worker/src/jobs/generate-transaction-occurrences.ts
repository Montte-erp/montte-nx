import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import {
   getActiveRecurringTransactions,
   getLastGeneratedTransactionForRule,
} from "@core/database/repositories/recurring-transactions-repository";
import { createTransaction } from "@core/database/repositories/transactions-repository";
import { team } from "@core/database/schemas/auth";
import { emitFinanceRecurringProcessed } from "@packages/events/finance";
import { emitEvent } from "@packages/events/emit";
import { getLogger } from "@core/logging/root";
import { db, redis } from "../singletons";

const logger = getLogger().child({ module: "job:recurring-transactions" });

function computeNextDate(
   from: string,
   frequency: "daily" | "weekly" | "monthly",
): string {
   const d = dayjs(from);
   switch (frequency) {
      case "daily":
         return d.add(1, "day").format("YYYY-MM-DD");
      case "weekly":
         return d.add(7, "day").format("YYYY-MM-DD");
      case "monthly":
         return d.add(1, "month").format("YYYY-MM-DD");
   }
}

export async function generateTransactionOccurrences(): Promise<void> {
   const rules = await getActiveRecurringTransactions(db);

   for (const rule of rules) {
      const lastTx = await getLastGeneratedTransactionForRule(db, rule.id);
      const fromDate = lastTx ? lastTx.date : rule.startDate;

      const today = dayjs();
      const windowEnd = today.add(rule.windowMonths, "month");

      const toCreate: {
         name: typeof rule.name;
         description: typeof rule.description;
         type: typeof rule.type;
         amount: typeof rule.amount;
         date: string;
         bankAccountId: typeof rule.bankAccountId;
         destinationBankAccountId: typeof rule.destinationBankAccountId;
         creditCardId: typeof rule.creditCardId;
         categoryId: typeof rule.categoryId;
         contactId: typeof rule.contactId;
         paymentMethod: typeof rule.paymentMethod;
         recurringTransactionId: typeof rule.id;
      }[] = [];

      const startAnchor = dayjs(fromDate).isBefore(today, "day")
         ? today.format("YYYY-MM-DD")
         : fromDate;
      let nextDate = lastTx
         ? computeNextDate(fromDate, rule.frequency)
         : startAnchor;

      while (
         dayjs(nextDate).isBefore(windowEnd) ||
         dayjs(nextDate).isSame(windowEnd, "day")
      ) {
         if (rule.endsAt && dayjs(nextDate).isAfter(dayjs(rule.endsAt))) break;

         toCreate.push({
            name: rule.name,
            description: rule.description,
            type: rule.type,
            amount: rule.amount,
            date: nextDate,
            bankAccountId: rule.bankAccountId,
            destinationBankAccountId: rule.destinationBankAccountId,
            creditCardId: rule.creditCardId,
            categoryId: rule.categoryId,
            contactId: rule.contactId,
            paymentMethod: rule.paymentMethod,
            recurringTransactionId: rule.id,
         });

         nextDate = computeNextDate(nextDate, rule.frequency);
      }

      if (toCreate.length === 0) continue;

      const [teamRow] = await db
         .select({ organizationId: team.organizationId })
         .from(team)
         .where(eq(team.id, rule.teamId))
         .limit(1);

      let created = 0;
      for (const txData of toCreate) {
         try {
            await createTransaction(db, rule.teamId, txData);
         } catch (err) {
            const pgErr = err as { code?: string };
            if (pgErr.code === "23505") continue;
            throw err;
         }
         created++;
         if (teamRow) {
            try {
               await emitFinanceRecurringProcessed(
                  (params) => emitEvent({ ...params, db, redis }),
                  {
                     organizationId: teamRow.organizationId,
                     teamId: rule.teamId,
                  },
                  {
                     recurringTransactionId: rule.id,
                     generatedCount: 1,
                     teamId: rule.teamId,
                  },
               );
            } catch (emitErr) {
               logger.error(
                  { err: emitErr, recurringTransactionId: rule.id },
                  "Failed to emit billing event",
               );
            }
         }
      }

      logger.info(
         { count: created, recurringTransactionId: rule.id },
         "Generated recurring transaction occurrences",
      );
   }
}
