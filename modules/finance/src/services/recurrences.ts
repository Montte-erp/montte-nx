import dayjs from "dayjs";
import { err, ok, type Result } from "neverthrow";
import type { TransactionRecurrenceFrequency } from "@core/database/schemas/transactions";

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

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
   if (!ISO_DATE_REGEX.test(value)) return false;
   const parsed = dayjs(value);
   return parsed.isValid() && parsed.format("YYYY-MM-DD") === value;
}

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
   if (!isValidIsoDate(input.date)) {
      return err("Data deve estar no formato YYYY-MM-DD.");
   }
   if (input.dueDate && !isValidIsoDate(input.dueDate)) {
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
