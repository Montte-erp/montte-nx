import dayjs from "dayjs";
import { AppError, validateInput } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import {
   financialConfig,
   financialConfigInsertSchema,
   type FinancialConfigInput,
} from "@core/database/schemas/settings-financial";

export function getFinancialConfig(db: DatabaseInstance, teamId: string) {
   return fromPromise(
      db
         .select()
         .from(financialConfig)
         .where(eq(financialConfig.teamId, teamId))
         .then(([row]) => row ?? null),
      (e) =>
         AppError.database("Falha ao buscar configurações financeiras.", {
            cause: e,
         }),
   );
}

export async function enforceCostCenterPolicy(
   db: DatabaseInstance,
   teamId: string,
   tagId: string | null | undefined,
) {
   const result = await getFinancialConfig(db, teamId);
   const config = result.isOk() ? result.value : null;
   if (config?.costCenterRequired && !tagId) {
      throw AppError.forbidden(
         "Centro de Custo é obrigatório para este espaço.",
      );
   }
}

export function upsertFinancialConfig(
   db: DatabaseInstance,
   teamId: string,
   data: FinancialConfigInput,
) {
   const validated = validateInput(financialConfigInsertSchema, data);
   return fromPromise(
      db.transaction(async (tx) => {
         const [row] = await tx
            .insert(financialConfig)
            .values({ teamId, ...validated })
            .onConflictDoUpdate({
               target: financialConfig.teamId,
               set: { ...validated, updatedAt: dayjs().toDate() },
            })
            .returning();
         if (!row)
            throw new Error("Falha ao salvar configurações financeiras.");
         return row;
      }),
      (e) =>
         AppError.database("Falha ao salvar configurações financeiras.", {
            cause: e,
         }),
   );
}
