import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import { updateContact } from "@core/database/repositories/contacts-repository";
import { contacts } from "@core/database/schemas/contacts";
import type { Contact } from "@core/database/schemas/contacts";
import { sdkProcedure } from "../server";
import type { SdkContext } from "../server";

function requireTeamId(teamId: SdkContext["teamId"]): string {
   if (!teamId) {
      throw new ORPCError("FORBIDDEN", {
         message:
            "Esta operação requer uma chave de API vinculada a um projeto.",
      });
   }
   return teamId;
}

function mapCustomer(contact: Contact) {
   return {
      ...contact,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
   };
}

export const create = sdkProcedure
   .input(
      z.object({
         name: z.string().min(2).max(120),
         email: z.string().email().nullable().optional(),
         phone: z.string().max(20).nullable().optional(),
         document: z.string().max(20).nullable().optional(),
         documentType: z.enum(["cpf", "cnpj"]).nullable().optional(),
         externalId: z.string().max(255).optional(),
         notes: z.string().max(500).nullable().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const teamId = requireTeamId(context.teamId);
      const [contact] = await context.db
         .insert(contacts)
         .values({
            teamId,
            name: input.name,
            type: "cliente",
            email: input.email ?? null,
            phone: input.phone ?? null,
            document: input.document ?? null,
            documentType: input.documentType ?? null,
            notes: input.notes ?? null,
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

export const get = sdkProcedure
   .input(z.object({ externalId: z.string() }))
   .handler(async ({ context, input }) => {
      const teamId = requireTeamId(context.teamId);
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

export const list = sdkProcedure
   .input(
      z.object({
         page: z.number().int().min(1).optional().default(1),
         limit: z.number().int().min(1).max(100).optional().default(20),
      }),
   )
   .handler(async ({ context, input }) => {
      const teamId = requireTeamId(context.teamId);
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

export const update = sdkProcedure
   .input(
      z.object({
         externalId: z.string(),
         name: z.string().min(2).max(120).optional(),
         email: z.string().email().nullable().optional(),
         phone: z.string().max(20).nullable().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const teamId = requireTeamId(context.teamId);
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
