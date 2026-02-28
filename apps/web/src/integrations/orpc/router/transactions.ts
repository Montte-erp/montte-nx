import { ORPCError } from "@orpc/server";
import {
	createTransaction,
	deleteTransaction,
	getTransactionWithTags,
	listTransactions,
	updateTransaction,
} from "@packages/database/repositories/transactions-repository";
import { transactions } from "@packages/database/schemas/transactions";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const transactionSchema = createInsertSchema(transactions)
	.pick({
		type: true,
		amount: true,
		description: true,
		date: true,
		bankAccountId: true,
		destinationBankAccountId: true,
		categoryId: true,
		subcategoryId: true,
		attachmentUrl: true,
	})
	.extend({
		tagIds: z.array(z.string().uuid()).optional().default([]),
	});

// =============================================================================
// Transaction Procedures
// =============================================================================

export const create = protectedProcedure
	.input(transactionSchema)
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		if (input.type === "transfer" && !input.destinationBankAccountId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Transferências exigem uma conta de destino.",
			});
		}
		const { tagIds, ...data } = input;
		return createTransaction(db, { ...data, teamId }, tagIds);
	});

export const getAll = protectedProcedure
	.input(
		z
			.object({
				type: z.enum(["income", "expense", "transfer"]).optional(),
				bankAccountId: z.string().uuid().optional(),
				categoryId: z.string().uuid().optional(),
				tagId: z.string().uuid().optional(),
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		return listTransactions(db, { teamId, ...input });
	});

export const getById = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const transaction = await getTransactionWithTags(db, input.id);
		if (!transaction || transaction.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", { message: "Transação não encontrada." });
		}
		return transaction;
	});

export const update = protectedProcedure
	.input(z.object({ id: z.string().uuid() }).merge(transactionSchema.partial()))
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const existing = await getTransactionWithTags(db, input.id);
		if (!existing || existing.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", { message: "Transação não encontrada." });
		}
		const { id, tagIds, ...data } = input;
		return updateTransaction(db, id, data, tagIds);
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const transaction = await getTransactionWithTags(db, input.id);
		if (!transaction || transaction.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", { message: "Transação não encontrada." });
		}
		await deleteTransaction(db, input.id);
		return { success: true };
	});
