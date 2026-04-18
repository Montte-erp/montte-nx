import dayjs from "dayjs";
import { AppError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { financialConfig } from "@core/database/schemas/settings-financial";

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

export function upsertFinancialConfig(
   db: DatabaseInstance,
   teamId: string,
   data: Partial<
      Omit<
         typeof financialConfig.$inferInsert,
         "teamId" | "createdAt" | "updatedAt"
      >
   >,
) {
   return fromPromise(
      (async () => {
         const [row] = await db
            .insert(financialConfig)
            .values({ teamId, ...data })
            .onConflictDoUpdate({
               target: financialConfig.teamId,
               set: { ...data, updatedAt: dayjs().toDate() },
            })
            .returning();
         if (!row) throw new Error("no row returned");
         return row;
      })(),
      (e) =>
         AppError.database("Falha ao salvar configurações financeiras.", {
            cause: e,
         }),
   );
}
