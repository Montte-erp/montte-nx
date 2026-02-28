import { ORPCError } from "@orpc/server";
import {
	createTag,
	deleteTag,
	getTag,
	listTags,
	updateTag,
} from "@packages/database/repositories/tags-repository";
import { tags } from "@packages/database/schemas/tags";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const tagSchema = createInsertSchema(tags).pick({ name: true, color: true });

// =============================================================================
// Tag Procedures
// =============================================================================

export const create = protectedProcedure
	.input(tagSchema)
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		return createTag(db, { ...input, teamId });
	});

export const getAll = protectedProcedure.handler(async ({ context }) => {
	const { db, teamId } = context;
	return listTags(db, teamId);
});

export const update = protectedProcedure
	.input(z.object({ id: z.string().uuid() }).merge(tagSchema.partial()))
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const tag = await getTag(db, input.id);
		if (!tag || tag.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada." });
		}
		const { id, ...data } = input;
		return updateTag(db, id, data);
	});

export const remove = protectedProcedure
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ context, input }) => {
		const { db, teamId } = context;
		const tag = await getTag(db, input.id);
		if (!tag || tag.teamId !== teamId) {
			throw new ORPCError("NOT_FOUND", { message: "Tag não encontrada." });
		}
		await deleteTag(db, input.id);
		return { success: true };
	});
