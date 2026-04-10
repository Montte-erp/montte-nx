import { DBOS } from "@dbos-inc/dbos-sdk";
import {
   createBillsBatch,
   getActiveRecurrenceSettings,
   getLastBillForRecurrenceGroup,
} from "@core/database/repositories/bills-repository";
import { getLogger } from "@core/logging/root";
import dayjs from "dayjs";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:bills" });

function computeNextDueDate(from: string, frequency: string): string {
   const d = dayjs(from);
   switch (frequency) {
      case "daily":
         return d.add(1, "day").format("YYYY-MM-DD");
      case "weekly":
         return d.add(1, "week").format("YYYY-MM-DD");
      case "biweekly":
         return d.add(2, "week").format("YYYY-MM-DD");
      case "monthly":
         return d.add(1, "month").format("YYYY-MM-DD");
      case "quarterly":
         return d.add(3, "month").format("YYYY-MM-DD");
      case "yearly":
         return d.add(1, "year").format("YYYY-MM-DD");
      default:
         throw new Error(`Unknown recurrence frequency: ${frequency}`);
   }
}

export class BillOccurrencesWorkflow {
   @DBOS.step()
   static async generateForSetting(settingId: string): Promise<void> {
      const settings = await getActiveRecurrenceSettings(db);
      const setting = settings.find((s) => s.id === settingId);
      if (!setting) return;

      const lastBill = await getLastBillForRecurrenceGroup(db, setting.id);
      if (!lastBill) return;

      const windowEnd = dayjs().add(setting.windowMonths, "month");

      const toCreate = [];
      let nextDue = computeNextDueDate(lastBill.dueDate, setting.frequency);

      while (!dayjs(nextDue).isAfter(windowEnd)) {
         if (setting.endsAt && dayjs(nextDue).isAfter(dayjs(setting.endsAt)))
            break;
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
         logger.info(
            { count: toCreate.length, recurrenceGroupId: setting.id },
            "Created bill occurrences",
         );
      }
   }

   @DBOS.scheduled({ crontab: "0 6 * * *" })
   @DBOS.workflow()
   static async run(_scheduledTime: Date, _startTime: Date): Promise<void> {
      const settings = await getActiveRecurrenceSettings(db);
      for (const setting of settings) {
         await BillOccurrencesWorkflow.generateForSetting(setting.id);
      }
   }
}
