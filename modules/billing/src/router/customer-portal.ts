import { implementerInternal } from "@orpc/server";
import { fromPromise } from "neverthrow";
import { getDomain } from "@core/environment/helpers";
import { WebAppError } from "@core/logging/errors";
import {
   type ORPCContext,
   type ORPCContextWithOrganization,
   protectedProcedure,
} from "@core/orpc/server";
import { hyprpayContract } from "@montte/hyprpay/contract";

const impl = implementerInternal<
   typeof hyprpayContract.customerPortal,
   ORPCContext,
   ORPCContextWithOrganization
>(hyprpayContract.customerPortal, protectedProcedure["~orpc"].config, [
   ...protectedProcedure["~orpc"].middlewares,
]);

export const createSession = impl.createSession.handler(
   async ({ context, input }) => {
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

      return { url: `${getDomain()}/portal/${context.teamId}` };
   },
);
