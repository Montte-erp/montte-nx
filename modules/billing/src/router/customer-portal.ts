import { fromPromise } from "neverthrow";
import { billingContract } from "@montte/hyprpay/contract";
import { implementerInternal } from "@orpc/server";
import { getDomain } from "@core/environment/helpers";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import type {
   ORPCContext,
   ORPCContextWithOrganization,
} from "@core/orpc/server";

const def = protectedProcedure["~orpc"];
const impl = implementerInternal<
   typeof billingContract.customerPortal,
   ORPCContext,
   ORPCContextWithOrganization
>(billingContract.customerPortal, def.config, [...def.middlewares]);

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
