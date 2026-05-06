import { chat, type UIMessage } from "@tanstack/ai";
import { z } from "zod";
import { fromPromise } from "neverthrow";
import { flashModel } from "@core/ai/models";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "agents.follow-ups" });

const followUpsSchema = z.array(z.string().min(2).max(140)).max(3);

interface GenerateFollowUpsOptions {
   history: UIMessage[];
   assistantParts: UIMessage["parts"];
}

export async function generateFollowUps(
   options: GenerateFollowUpsOptions,
): Promise<string[]> {
   const tail = options.history.slice(-2).map((m) => ({
      role: m.role,
      parts: m.parts,
   }));

   const result = await fromPromise(
      chat({
         adapter: flashModel,
         outputSchema: followUpsSchema,
         messages: [
            {
               role: "user",
               content: [
                  {
                     type: "text",
                     content: `Baseado nestas mensagens, sugira até 3 perguntas curtas em pt-BR que o usuário poderia fazer em seguida. Retorne JSON puro: array de strings.

Conversa recente:
${JSON.stringify({ history: tail, assistant: options.assistantParts })}`,
                  },
               ],
            },
         ],
         stream: false,
      }),
      (e) => e,
   );

   if (result.isErr()) {
      logger.warn({ err: result.error }, "follow-ups generation failed");
      return [];
   }
   return result.value;
}
