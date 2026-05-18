import { describe, expect, it } from "vitest";
import { buildRecurrenceOccurrences } from "../../src/transactions";

describe("recurrences", () => {
   it("calcula próximas ocorrências nas periodicidades suportadas", () => {
      const daily = buildRecurrenceOccurrences({
         date: "2026-05-15",
         dueDate: "2026-05-20",
         frequency: "daily",
      });
      const weekly = buildRecurrenceOccurrences({
         date: "2026-05-15",
         dueDate: "2026-05-20",
         frequency: "weekly",
      });
      const biweekly = buildRecurrenceOccurrences({
         date: "2026-05-15",
         dueDate: "2026-05-20",
         frequency: "biweekly",
      });
      const monthly = buildRecurrenceOccurrences({
         date: "2026-05-15",
         dueDate: "2026-05-20",
         frequency: "monthly",
      });

      expect(daily.isOk()).toBe(true);
      expect(weekly.isOk()).toBe(true);
      expect(biweekly.isOk()).toBe(true);
      expect(monthly.isOk()).toBe(true);
      if (
         daily.isErr() ||
         weekly.isErr() ||
         biweekly.isErr() ||
         monthly.isErr()
      ) {
         return;
      }
      expect(daily.value[1]?.date).toBe("2026-05-16");
      expect(weekly.value[1]?.date).toBe("2026-05-22");
      expect(biweekly.value[1]?.date).toBe("2026-05-29");
      expect(monthly.value[1]?.date).toBe("2026-06-15");
   });

   it("rejeita data inválida em pt-BR", () => {
      const result = buildRecurrenceOccurrences({
         date: "15/05/2026",
         frequency: "monthly",
      });

      expect(result.isErr()).toBe(true);
      if (result.isOk()) return;
      expect(result.error).toBe("Data deve estar no formato YYYY-MM-DD.");
   });
});
