import * as chatRepo from "@core/database/repositories/chat-repository";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const listThreads = protectedProcedure
   .input(
      z.object({
         teamId: z.uuid(),
         page: z.number().int().min(0).default(0),
         perPage: z.number().int().min(1).max(50).default(20),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await chatRepo.listThreads(
         context.db,
         `${input.teamId}:${context.userId}`,
         input.page,
         input.perPage,
      );
      return {
         threads: result.threads.map((t) => ({
            id: t.id,
            title: t.title ?? "Nova conversa",
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
         })),
         total: result.total,
         hasMore: result.hasMore,
      };
   });

export const createThread = protectedProcedure
   .input(
      z.object({
         teamId: z.uuid(),
         title: z.string().optional(),
         metadata: z.record(z.string(), z.unknown()).optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const thread = await chatRepo.createThread(
         context.db,
         `${input.teamId}:${context.userId}`,
         input.title,
         input.metadata,
      );
      return {
         id: thread.id,
         title: thread.title ?? "Nova conversa",
         createdAt: thread.createdAt,
      };
   });

export const deleteThread = protectedProcedure
   .input(z.object({ threadId: z.string() }))
   .handler(async ({ input, context }) => {
      const thread = await chatRepo.getThreadById(context.db, input.threadId);
      if (!thread?.resourceId.endsWith(`:${context.userId}`)) {
         throw WebAppError.forbidden("Thread not found or access denied");
      }
      await chatRepo.deleteThread(context.db, input.threadId);
   });

export const getThreadMessages = protectedProcedure
   .input(z.object({ threadId: z.string() }))
   .handler(async ({ input, context }) => {
      const thread = await chatRepo.getThreadById(context.db, input.threadId);
      if (!thread?.resourceId.endsWith(`:${context.userId}`)) {
         throw WebAppError.forbidden("Thread not found or access denied");
      }
      return chatRepo.getThreadMessages(context.db, input.threadId);
   });
