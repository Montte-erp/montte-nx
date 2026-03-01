import { ORPCError } from "@orpc/server";
import {
	contactHasTransactions,
	createContact,
	deleteContact,
	getContact,
	listContacts,
	updateContact,
} from "@packages/database/repositories/contacts-repository";
import { contacts } from "@packages/database/schemas/contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const contactSchema = createInsertSchema(contacts).pick({
	name: true,
	type: true,
	email: true,
	phone: true,
	document: true,
	documentType: true,
	notes: true,
});

// =============================================================================
// Contact Procedures
// =============================================================================

export const create = protectedProcedure
	.input(contactSchema)
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		return createContact(db, { ...input, teamId });
	});

export const getAll = protectedProcedure
	.input(
		z
			.object({
				type: z
					.enum(["cliente", "fornecedor", "ambos"])
					.optional(),
			})
			.optional(),
	)
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		return listContacts(db, teamId, input?.type);
	});

export const update = protectedProcedure
	.input(
		z
			.object({ id: z.string().uuid() })
			.merge(contactSchema.partial()),
	)
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const contact = await getContact(db, input.id);
		if (!contact || contact.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", {
				message: "Contato não encontrado.",
			});
		}
		const { id, ...data } = input;
		return updateContact(db, id, data);
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const contact = await getContact(db, input.id);
		if (!contact || contact.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", {
				message: "Contato não encontrado.",
			});
		}
		const hasTransactions = await contactHasTransactions(db, input.id);
		if (hasTransactions) {
			throw new ORPCError("CONFLICT", {
				message:
					"Não é possível excluir um contato com transações vinculadas.",
			});
		}
		await deleteContact(db, input.id);
		return { success: true };
	});
