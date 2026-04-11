import { implementerInternal } from "@orpc/server";
import { Result, err, ok } from "neverthrow";
import { WebAppError } from "@core/logging/errors";
import {
   createContact,
   getContactByExternalId,
   listContactsPaginated,
   updateContact,
} from "@core/database/repositories/contacts-repository";
import type { Contact } from "@core/database/schemas/contacts";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../server";
import type { SdkContext } from "../server";

const impl = implementerInternal(
   hyprpayContract,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function requireTeamId(
   teamId: SdkContext["teamId"],
): Result<string, WebAppError<"FORBIDDEN">> {
   if (!teamId) {
      return err(
         new WebAppError("FORBIDDEN", {
            message:
               "Esta operação requer uma chave de API vinculada a um projeto.",
            source: "hyprpay",
         }),
      );
   }
   return ok(teamId);
}

function mapCustomer(contact: Contact) {
   return {
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
   };
}

export const create = impl.create.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const contact = await createContact(context.db, teamId, {
      name: input.name,
      type: "cliente",
      email: input.email ?? null,
      phone: input.phone ?? null,
      document: input.document ?? null,
      externalId: input.externalId ?? null,
   });
   return mapCustomer(contact);
});

export const get = impl.get.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const contact = await getContactByExternalId(
      context.db,
      input.externalId,
      teamId,
      "cliente",
   );
   if (!contact || contact.isArchived) {
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });
   }
   return mapCustomer(contact);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const { items, total } = await listContactsPaginated(context.db, teamId, {
      page: input.page,
      limit: input.limit,
      type: "cliente",
   });
   return {
      items: items.map(mapCustomer),
      total,
      page: input.page,
      limit: input.limit,
      pages: Math.ceil(total / input.limit),
   };
});

export const update = impl.update.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const { externalId, ...data } = input;
   const existing = await getContactByExternalId(
      context.db,
      externalId,
      teamId,
      "cliente",
   );
   if (!existing) {
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });
   }
   const updated = await updateContact(context.db, existing.id, data);
   return mapCustomer(updated);
});
