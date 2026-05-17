import dayjs from "dayjs";
import { err, ok, type Result } from "neverthrow";
import type { TransactionRecurrenceFrequency } from "@core/database/schemas/transactions";
import { isIsoDateString } from "@core/utils/dates";

export type RecurrenceInput = {
   date: string;
   dueDate?: string | null;
   frequency: TransactionRecurrenceFrequency;
};

export type RecurrenceOccurrence = {
   number: number;
   date: string;
   dueDate: string | null;
};

export function addRecurrencePeriod(
   date: string,
   frequency: TransactionRecurrenceFrequency,
) {
   if (frequency === "daily") {
      return dayjs(date).add(1, "day").format("YYYY-MM-DD");
   }
   if (frequency === "weekly") {
      return dayjs(date).add(1, "week").format("YYYY-MM-DD");
   }
   if (frequency === "biweekly") {
      return dayjs(date).add(2, "week").format("YYYY-MM-DD");
   }
   return dayjs(date).add(1, "month").format("YYYY-MM-DD");
}

export function buildRecurrenceOccurrences(
   input: RecurrenceInput,
): Result<RecurrenceOccurrence[], string> {
   if (!isIsoDateString(input.date)) {
      return err("Data deve estar no formato YYYY-MM-DD.");
   }
   if (input.dueDate && !isIsoDateString(input.dueDate)) {
      return err("Vencimento deve estar no formato YYYY-MM-DD.");
   }

   const nextDate = addRecurrencePeriod(input.date, input.frequency);
   return ok([
      { number: 1, date: input.date, dueDate: input.dueDate ?? null },
      {
         number: 2,
         date: nextDate,
         dueDate: input.dueDate
            ? addRecurrencePeriod(input.dueDate, input.frequency)
            : null,
      },
   ]);
}
