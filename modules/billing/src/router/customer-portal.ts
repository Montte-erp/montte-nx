import { fromPromise } from "neverthrow";
import { getDomain } from "@core/environment/helpers";
import { WebAppError } from "@core/logging/errors";
import { billingImpl } from "./_implementer";

export const createSession = billingImpl.customerPortal.createSession.handler(
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
