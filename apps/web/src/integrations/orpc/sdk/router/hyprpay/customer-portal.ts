import { implementerInternal } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
import { getDomain } from "@core/environment/helpers";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { getContactByExternalId } from "@core/database/repositories/contacts-repository";
import { requireTeamId } from "./utils";

const impl = implementerInternal(
   hyprpayContract.customerPortal,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

export const createSession = impl.createSession.handler(
   async ({ context, input }) => {
      const teamIdResult = requireTeamId(context.teamId);
      if (teamIdResult.isErr()) throw teamIdResult.error;
      const teamId = teamIdResult.value;

      const contactResult = await getContactByExternalId(
         context.db,
         input.externalId,
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

      const url = `${getDomain()}/portal/${teamId}`;

      return { url };
   },
);
