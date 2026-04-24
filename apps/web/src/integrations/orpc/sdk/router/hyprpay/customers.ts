import { implementerInternal } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
import {
   createContact,
   getContactByExternalId,
   listContactsPaginated,
   updateContact,
} from "@core/database/repositories/contacts-repository";
import type { Contact } from "@core/database/schemas/contacts";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../../server";
import { requireTeamId } from "./utils";

const impl = implementerInternal(
   hyprpayContract,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

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
   const contactResult = await createContact(context.db, teamId, {
      name: input.name,
      type: "cliente",
      email: input.email ?? null,
      phone: input.phone ?? null,
      document: input.document ?? null,
      externalId: input.externalId ?? null,
   });
   if (contactResult.isErr())
      throw WebAppError.fromAppError(contactResult.error);
   return mapCustomer(contactResult.value);
});

export const get = impl.get.handler(async ({ context, input }) => {
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
   if (!contactResult.value || contactResult.value.isArchived) {
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });
   }
   return mapCustomer(contactResult.value);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const listResult = await listContactsPaginated(context.db, teamId, {
      page: input.page,
      limit: input.limit,
      type: "cliente",
   });
   if (listResult.isErr()) throw WebAppError.fromAppError(listResult.error);
   const { items, total } = listResult.value;
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
   const existingResult = await getContactByExternalId(
      context.db,
      externalId,
      teamId,
      "cliente",
   );
   if (existingResult.isErr())
      throw WebAppError.fromAppError(existingResult.error);
   if (!existingResult.value) {
      throw new WebAppError("NOT_FOUND", {
         message: "Cliente não encontrado.",
         source: "hyprpay",
      });
   }
   const updatedResult = await updateContact(
      context.db,
      existingResult.value.id,
      data,
   );
   if (updatedResult.isErr())
      throw WebAppError.fromAppError(updatedResult.error);
   return mapCustomer(updatedResult.value);
});
