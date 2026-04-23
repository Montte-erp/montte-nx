import { AppError } from "@core/logging/errors";
import { and, eq } from "drizzle-orm";
import { fromPromise, ok } from "neverthrow";
import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
import { benefitGrants } from "@core/database/schemas/benefit-grants";

export function grantBenefits(
   db: DatabaseInstance,
   teamId: string,
   subscriptionId: string,
   benefitIds: string[],
) {
   if (benefitIds.length === 0) return ok([]);
   return fromPromise(
      db.transaction(async (tx) => {
         const rows = await tx
            .insert(benefitGrants)
            .values(
               benefitIds.map((benefitId) => ({
                  teamId,
                  subscriptionId,
                  benefitId,
                  status: "active" as const,
               })),
            )
            .onConflictDoNothing({
               target: [benefitGrants.subscriptionId, benefitGrants.benefitId],
            })
            .returning();
         return rows;
      }),
      (e) => AppError.database("Falha ao conceder benefícios.", { cause: e }),
   );
}

export function revokeBenefits(db: DatabaseInstance, subscriptionId: string) {
   return fromPromise(
      db.transaction(async (tx) => {
         await tx
            .update(benefitGrants)
            .set({ status: "revoked", revokedAt: dayjs().toDate() })
            .where(
               and(
                  eq(benefitGrants.subscriptionId, subscriptionId),
                  eq(benefitGrants.status, "active"),
               ),
            );
      }),
      (e) => AppError.database("Falha ao revogar benefícios.", { cause: e }),
   ).map(() => undefined);
}

export function listGrantsBySubscription(
   db: DatabaseInstance,
   subscriptionId: string,
) {
   return fromPromise(
      db.query.benefitGrants.findMany({
         where: (fields, { eq }) => eq(fields.subscriptionId, subscriptionId),
      }),
      (e) =>
         AppError.database("Falha ao listar concessões de benefícios.", {
            cause: e,
         }),
   );
}
