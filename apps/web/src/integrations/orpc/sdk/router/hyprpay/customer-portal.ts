import { implementerInternal } from "@orpc/server";
import { err, fromPromise, ok } from "neverthrow";
import { SignJWT } from "jose";
import { WebAppError } from "@core/logging/errors";
import { env } from "@core/environment/web";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import type { SdkContext } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import dayjs from "dayjs";

const impl = implementerInternal(
   hyprpayContract.customerPortal,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function requireTeamId(teamId: SdkContext["teamId"]) {
   if (!teamId)
      return err(
         new WebAppError("FORBIDDEN", {
            message:
               "Esta operação requer uma chave de API vinculada a um projeto.",
            source: "hyprpay",
         }),
      );
   return ok(teamId);
}

export const createSession = impl.createSession.handler(
   async ({ context, input }) => {
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

      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const expiresAt = dayjs().add(15, "minute");

      const signResult = await fromPromise(
         new SignJWT({
            sub: input.customerId,
            teamId,
            contactId: contactResult.value.id,
         })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime(expiresAt.toDate())
            .sign(secret),
         (e) =>
            new WebAppError("INTERNAL_SERVER_ERROR", {
               message: "Falha ao gerar sessão do portal.",
               source: "hyprpay",
               cause: e,
            }),
      );
      if (signResult.isErr()) throw signResult.error;

      const baseUrl = env.APP_URL ?? "https://app.montte.co";
      const url = `${baseUrl}/portal/${teamId}?token=${signResult.value}`;

      return { url, expiresAt: expiresAt.toISOString() };
   },
);
