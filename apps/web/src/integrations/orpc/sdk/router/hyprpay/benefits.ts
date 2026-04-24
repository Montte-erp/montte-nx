import { implementerInternal } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";

type BenefitCheckStatus = "granted" | "revoked" | "not_found";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import { listGrantsWithBenefitsByContact } from "@core/database/repositories/benefit-grants-repository";
import { requireTeamId } from "./utils";

const impl = implementerInternal(
   hyprpayContract.benefits,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

export const check = impl.check.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      context.db,
      input.customerId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value)
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });

   const grantsResult = await listGrantsWithBenefitsByContact(
      context.db,
      teamId,
      contactResult.value.id,
   );
   if (grantsResult.isErr()) throw WebAppError.fromAppError(grantsResult.error);

   const allMatches = grantsResult.value.filter(
      (row) => row.benefit.id === input.benefitId,
   );
   const match =
      allMatches.find((row) => row.grant.status === "active") ?? allMatches[0];

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
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;

   const contactResult = await getContactByExternalId(
      context.db,
      input.customerId,
      teamId,
      "cliente",
   );
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   if (!contactResult.value)
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });

   const grantsResult = await listGrantsWithBenefitsByContact(
      context.db,
      teamId,
      contactResult.value.id,
   );
   if (grantsResult.isErr()) throw WebAppError.fromAppError(grantsResult.error);

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
