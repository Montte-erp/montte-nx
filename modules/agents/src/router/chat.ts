import { eventIterator } from "@orpc/server";
import { chat } from "@tanstack/ai";
import { fromPromise } from "neverthrow";
import { getLogger } from "@core/logging/root";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { buildRubiChatArgs } from "../agents/rubi";
import { chatInputSchema, chatStreamEventSchema } from "../contracts/chat";

const logger = getLogger().child({ module: "agents.chat" });

export const stream = protectedProcedure
   .input(chatInputSchema)
   .output(eventIterator(chatStreamEventSchema))
   .handler(async function* ({ context, input, signal }) {
      logger.info(
         {
            userId: context.userId,
            teamId: context.teamId,
            messages: input.messages.length,
         },
         "rubi chat stream start",
      );

      const args = buildRubiChatArgs({
         db: context.db,
         teamId: context.teamId,
         userId: context.userId,
         organizationId: context.organizationId,
         messages: input.messages,
         pageContext: input.pageContext,
         abortSignal: signal,
      });

      const iterable = chat(args);

      for await (const event of iterable) {
         yield event;
      }

      logger.info({ userId: context.userId }, "rubi chat stream end");
   });

export const ping = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      Promise.resolve({ ok: true, teamId: context.teamId }),
      () => WebAppError.internal("Falha ao verificar status do Rubi."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});
