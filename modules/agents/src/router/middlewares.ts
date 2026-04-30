import { os } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { err, fromPromise, ok } from "neverthrow";
import { threadMessages } from "@core/database/schemas/threads";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { parseMessageParts } from "@modules/agents/messages";

const base = os.$context<ORPCContextWithOrganization>();

export const requireThread = base.middleware(
   async ({ context, next }, id: string) => {
      const result = await fromPromise(
         context.db.query.threads.findFirst({
            where: (f, { eq }) => eq(f.id, id),
         }),
         () => WebAppError.internal("Falha ao verificar conversa."),
      ).andThen((thread) => {
         if (thread === undefined) {
            return err(WebAppError.notFound("Conversa não encontrada."));
         }
         if (thread.teamId !== context.teamId) {
            return err(WebAppError.notFound("Conversa não encontrada."));
         }
         if (thread.organizationId !== context.organizationId) {
            return err(WebAppError.notFound("Conversa não encontrada."));
         }
         if (thread.userId !== context.userId) {
            return err(WebAppError.notFound("Conversa não encontrada."));
         }
         return ok(thread);
      });
      if (result.isErr()) throw result.error;
      return next({ context: { thread: result.value } });
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
                  const parsedParts = parseMessageParts(row.parts);
                  if (!parsedParts.success) return [];
                  const content = parsedParts.data
                     .flatMap((part) => {
                        if (part.type !== "text") return [];
                        return [part.content];
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
