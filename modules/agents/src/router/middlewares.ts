import { os } from "@orpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { z } from "zod";
import { threadMessages } from "@core/database/schemas/threads";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const base = os.$context<ORPCContextWithOrganization>();

const messagePartSchema = z.object({ type: z.string() }).passthrough();
const textPartSchema = z
   .object({ type: z.literal("text"), content: z.string() })
   .passthrough();

export const requireThread = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.threads.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar conversa."),
      ).andThen((thread) => {
         if (thread === undefined || thread.teamId !== context.teamId) {
            return err(WebAppError.notFound("Conversa não encontrada."));
         }
         return ok(thread);
      });
      if (result.isErr()) throw result.error;
      return next({ context: { thread: result.value } });
   },
);

export const withNextThreadMessageSequence = base.middleware(
   async ({ context, next }, threadId: string) => {
      const result = await fromPromise(
         context.db
            .select({
               sequence: sql<number>`coalesce(max(${threadMessages.sequence}), -1) + 1`,
            })
            .from(threadMessages)
            .where(eq(threadMessages.threadId, threadId)),
         () => WebAppError.internal("Falha ao preparar mensagem."),
      ).andThen((rows) => {
         const row = rows[0];
         if (row === undefined) {
            return err(WebAppError.internal("Falha ao preparar mensagem."));
         }
         return ok(row.sequence);
      });
      if (result.isErr()) throw result.error;
      return next({ context: { nextThreadMessageSequence: result.value } });
   },
);

export const withThreadChatMessages = base.middleware(
   async ({ context, next }, threadId: string) => {
      const result = await fromPromise(
         context.db
            .select()
            .from(threadMessages)
            .where(eq(threadMessages.threadId, threadId))
            .orderBy(asc(threadMessages.sequence))
            .then((rows) =>
               rows.flatMap((row) => {
                  if (row.role === "system") return [];
                  const parts = z.array(messagePartSchema).parse(row.parts);
                  const content = parts
                     .flatMap((part) => {
                        const text = textPartSchema.safeParse(part);
                        return text.success ? [text.data.content] : [];
                     })
                     .join("");
                  return [
                     {
                        id: row.id,
                        role: row.role,
                        content,
                        ...(row.toolCallId && { toolCallId: row.toolCallId }),
                     },
                  ];
               }),
            ),
         () => WebAppError.internal("Falha ao carregar histórico."),
      );
      if (result.isErr()) throw result.error;
      return next({ context: { chatMessages: result.value } });
   },
);
