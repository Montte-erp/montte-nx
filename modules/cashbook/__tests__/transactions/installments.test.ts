import { describe, expect, it } from "vitest";
import { buildInstallmentPreview } from "../../src/transactions";

describe("installments", () => {
   it("distribui centavos restantes nas primeiras parcelas", () => {
      const result = buildInstallmentPreview({
         amount: "100.00",
         count: 3,
         date: "2026-05-15",
         dueDate: "2026-05-20",
      });

      expect(result.isOk()).toBe(true);
      if (result.isErr()) return;

      expect(result.value.map((p) => p.amount)).toEqual([
         "33.34",
         "33.33",
         "33.33",
      ]);
      expect(result.value.map((p) => p.date)).toEqual([
         "2026-05-15",
         "2026-06-15",
         "2026-07-15",
      ]);
      expect(result.value.map((p) => p.dueDate)).toEqual([
         "2026-05-20",
         "2026-06-20",
         "2026-07-20",
      ]);
   });

   it("rejeita total baixo demais para a quantidade de parcelas", () => {
      const result = buildInstallmentPreview({
         amount: "0.01",
         count: 2,
         date: "2026-05-15",
      });

      expect(result.isErr()).toBe(true);
      if (result.isOk()) return;
      expect(result.error.message).toBe(
         "Valor total é baixo demais para o número de parcelas.",
      );
   });

   it("rejeita datas inválidas com mensagem em pt-BR", () => {
      const result = buildInstallmentPreview({
         amount: "100.00",
         count: 2,
         date: "2026-02-31",
      });

      expect(result.isErr()).toBe(true);
      if (result.isOk()) return;
      expect(result.error.message).toBe(
         "Data deve estar no formato YYYY-MM-DD.",
      );
   });
});
