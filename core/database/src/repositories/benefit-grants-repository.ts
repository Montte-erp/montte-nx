import { AppError } from "@core/logging/errors";
import { and, eq, inArray } from "drizzle-orm";
import { fromPromise, ok } from "neverthrow";
import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import { benefits } from "@core/database/schemas/benefits";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";

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
            .onConflictDoUpdate({
               target: [benefitGrants.subscriptionId, benefitGrants.benefitId],
               set: { status: "active", revokedAt: null },
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

export function listGrantsWithBenefitsByContact(
   db: DatabaseInstance,
   teamId: string,
   contactId: string,
) {
   return fromPromise(
      (async () => {
         const subs = await db
            .select({ id: contactSubscriptions.id })
            .from(contactSubscriptions)
            .where(
               and(
                  eq(contactSubscriptions.contactId, contactId),
                  eq(contactSubscriptions.teamId, teamId),
               ),
            );

         if (subs.length === 0) return [];

         const subIds = subs.map((s) => s.id);

         return db
            .select({
               grant: benefitGrants,
               benefit: benefits,
            })
            .from(benefitGrants)
            .innerJoin(benefits, eq(benefitGrants.benefitId, benefits.id))
            .where(inArray(benefitGrants.subscriptionId, subIds));
      })(),
      (e) =>
         AppError.database("Falha ao buscar concessões de benefícios.", {
            cause: e,
         }),
   );
}
