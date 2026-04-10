import { ORPCError, implementerInternal } from "@orpc/server";
import { Result, err, ok } from "neverthrow";
import { and, asc, count, eq } from "drizzle-orm";
import { updateContact } from "@core/database/repositories/contacts-repository";
import { contacts } from "@core/database/schemas/contacts";
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
): Result<string, ORPCError<"FORBIDDEN", unknown>> {
   if (!teamId) {
      return err(
         new ORPCError("FORBIDDEN", {
            message:
               "Esta operação requer uma chave de API vinculada a um projeto.",
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
   const [contact] = await context.db
      .insert(contacts)
      .values({
         teamId,
         name: input.name,
         type: "cliente",
         email: input.email ?? null,
         phone: input.phone ?? null,
         document: input.document ?? null,
         externalId: input.externalId ?? null,
      })
      .returning();
   if (!contact) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
         message: "Falha ao criar cliente.",
      });
   }
   return mapCustomer(contact);
});

export const get = impl.get.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const [contact] = await context.db
      .select()
      .from(contacts)
      .where(
         and(
            eq(contacts.externalId, input.externalId),
            eq(contacts.teamId, teamId),
            eq(contacts.type, "cliente"),
            eq(contacts.isArchived, false),
         ),
      );
   if (!contact) {
      throw new ORPCError("NOT_FOUND", {
         message: "Cliente não encontrado.",
      });
   }
   return mapCustomer(contact);
});

export const list = impl.list.handler(async ({ context, input }) => {
   const teamIdResult = requireTeamId(context.teamId);
   if (teamIdResult.isErr()) throw teamIdResult.error;
   const teamId = teamIdResult.value;
   const where = and(
      eq(contacts.teamId, teamId),
      eq(contacts.type, "cliente"),
      eq(contacts.isArchived, false),
   );
   const [totalResult] = await context.db
      .select({ value: count() })
      .from(contacts)
      .where(where);
   const total = totalResult?.value ?? 0;
   const items = await context.db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(asc(contacts.name))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit);
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
   const [existing] = await context.db
      .select()
      .from(contacts)
      .where(
         and(
            eq(contacts.externalId, externalId),
            eq(contacts.teamId, teamId),
            eq(contacts.type, "cliente"),
         ),
      );
   if (!existing) {
      throw new ORPCError("NOT_FOUND", {
         message: "Cliente não encontrado.",
      });
   }
   const updated = await updateContact(context.db, existing.id, data);
   return mapCustomer(updated);
});
