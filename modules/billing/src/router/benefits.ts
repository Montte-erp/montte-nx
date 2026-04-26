import { implementerInternal } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import { benefits } from "@core/database/schemas/benefits";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import {
   type ORPCContext,
   type ORPCContextWithOrganization,
   protectedProcedure,
} from "@core/orpc/server";
import { hyprpayContract } from "@montte/hyprpay/contract";

type BenefitCheckStatus = "granted" | "revoked" | "not_found";

const impl = implementerInternal<
   typeof hyprpayContract.benefits,
   ORPCContext,
   ORPCContextWithOrganization
>(hyprpayContract.benefits, protectedProcedure["~orpc"].config, [
   ...protectedProcedure["~orpc"].middlewares,
]);

async function listGrantsWithBenefits(
   db: import("@core/database/client").DatabaseInstance,
   teamId: string,
   contactId: string,
) {
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
      .select({ grant: benefitGrants, benefit: benefits })
      .from(benefitGrants)
      .innerJoin(benefits, eq(benefitGrants.benefitId, benefits.id))
      .where(inArray(benefitGrants.subscriptionId, subIds));
}

export const check = impl.check.handler(async ({ context, input }) => {
   const contactResult = await fromPromise(
      context.db.query.contacts.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.externalId, input.externalId),
               eq(f.teamId, context.teamId),
               eq(f.type, "cliente"),
            ),
      }),
      () => WebAppError.internal("Falha ao buscar cliente."),
   );
   if (contactResult.isErr()) throw contactResult.error;
   if (!contactResult.value)
      throw WebAppError.notFound("Cliente não encontrado.");

   const grantsResult = await fromPromise(
      listGrantsWithBenefits(
         context.db,
         context.teamId,
         contactResult.value.id,
      ),
      () => WebAppError.internal("Falha ao buscar benefícios."),
   );
   if (grantsResult.isErr()) throw grantsResult.error;

   const matches = grantsResult.value.filter(
      (row) => row.benefit.id === input.benefitId,
   );
   const match =
      matches.find((row) => row.grant.status === "active") ?? matches[0];

   if (!match) {
      const status: BenefitCheckStatus = "not_found";
      return { status, grantedAt: null, revokedAt: null, subscriptionId: null };
   }

   const status: BenefitCheckStatus =
      match.grant.status === "active" ? "granted" : "revoked";

   return {
      status,
      grantedAt: match.grant.grantedAt.toISOString(),
      revokedAt: match.grant.revokedAt?.toISOString() ?? null,
      subscriptionId: match.grant.subscriptionId,
   };
});

export const list = impl.list.handler(async ({ context, input }) => {
   const contactResult = await fromPromise(
      context.db.query.contacts.findFirst({
         where: (f, { and, eq }) =>
            and(
               eq(f.externalId, input.externalId),
               eq(f.teamId, context.teamId),
               eq(f.type, "cliente"),
            ),
      }),
      () => WebAppError.internal("Falha ao buscar cliente."),
   );
   if (contactResult.isErr()) throw contactResult.error;
   if (!contactResult.value)
      throw WebAppError.notFound("Cliente não encontrado.");

   const grantsResult = await fromPromise(
      listGrantsWithBenefits(
         context.db,
         context.teamId,
         contactResult.value.id,
      ),
      () => WebAppError.internal("Falha ao buscar benefícios."),
   );
   if (grantsResult.isErr()) throw grantsResult.error;

   return grantsResult.value.map((row) => ({
      id: row.grant.id,
      benefitId: row.grant.benefitId,
      subscriptionId: row.grant.subscriptionId,
      status: row.grant.status,
      grantedAt: row.grant.grantedAt.toISOString(),
      revokedAt: row.grant.revokedAt?.toISOString() ?? null,
      benefit: {
         id: row.benefit.id,
         name: row.benefit.name,
         type: row.benefit.type,
         description: row.benefit.description ?? null,
      },
   }));
});
