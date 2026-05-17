import dayjs from "dayjs";
import { err, ok, type Result } from "neverthrow";
import { isIsoDateString } from "@core/utils/dates";

export type InstallmentInput = {
   amount: string;
   date: string;
   dueDate?: string | null;
   count: number;
};

export type InstallmentPreview = {
   number: number;
   count: number;
   amount: string;
   date: string;
   dueDate: string | null;
};

const DECIMAL_REGEX = /^(\d+)(?:\.(\d+))?$/;

function parseMoneyToCents(value: string): Result<number, string> {
   const normalized = value.trim();
   const match = DECIMAL_REGEX.exec(normalized);
   if (!match) return err("Valor deve ser um número válido maior que zero.");

   const [, majorRaw, minorRaw = ""] = match;
   if (!majorRaw) return err("Valor deve ser um número válido maior que zero.");

   const major = Number(majorRaw);
   const centsText = minorRaw.padEnd(3, "0");
   const centsBase = Number(centsText.slice(0, 2));
   const shouldRound = Number(centsText.slice(2, 3)) >= 5;
   const cents = major * 100 + centsBase + (shouldRound ? 1 : 0);

   if (!Number.isSafeInteger(cents) || cents <= 0) {
      return err("Valor deve ser um número válido maior que zero.");
   }

   return ok(cents);
}

function formatCents(cents: number) {
   const major = Math.floor(cents / 100);
   const minor = String(cents % 100).padStart(2, "0");
   return `${major}.${minor}`;
}

export function buildInstallmentPreview(
   input: InstallmentInput,
): Result<InstallmentPreview[], string> {
   if (!Number.isInteger(input.count) || input.count < 2) {
      return err("Número de parcelas deve ser maior que 1.");
   }
   if (!isIsoDateString(input.date)) {
      return err("Data deve estar no formato YYYY-MM-DD.");
   }
   if (input.dueDate && !isIsoDateString(input.dueDate)) {
      return err("Vencimento deve estar no formato YYYY-MM-DD.");
   }

   const parsed = parseMoneyToCents(input.amount);
   if (parsed.isErr()) return err(parsed.error);

   const baseAmount = Math.floor(parsed.value / input.count);
   const remainder = parsed.value % input.count;

   if (baseAmount <= 0) {
      return err("Valor total é baixo demais para o número de parcelas.");
   }

   return ok(
      Array.from({ length: input.count }, (_, index) => {
         const number = index + 1;
         const amount = baseAmount + (index < remainder ? 1 : 0);
         return {
            number,
            count: input.count,
            amount: formatCents(amount),
            date: dayjs(input.date).add(index, "month").format("YYYY-MM-DD"),
            dueDate: input.dueDate
               ? dayjs(input.dueDate).add(index, "month").format("YYYY-MM-DD")
               : null,
         };
      }),
   );
}
