import { fromPromise } from "neverthrow";
import { chat } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { AppError } from "@core/logging/errors";

type OpenRouterModelId = Parameters<typeof openRouterText>[0];

export type TagOption = {
   id: string;
   name: string;
   description?: string | null;
};

const outputSchema = z.object({
   tagName: z.string().nullable(),
   confidence: z.enum(["high", "low"]),
});

export function inferTagWithAI(
   tagOptions: TagOption[],
   transactionName: string,
   model: OpenRouterModelId,
) {
   const list = tagOptions
      .map((t) => `- ${t.name}${t.description ? ` (${t.description})` : ""}`)
      .join("\n");

   const prompt = `Você é um assistente financeiro brasileiro. Com base no nome da transação abaixo, identifique o Centro de Custo mais adequado da lista.

Transação: ${transactionName}

Centros de Custo disponíveis:
${list}

Retorne o nome exato de um Centro de Custo da lista, ou null se nenhum for adequado.
Se tiver certeza, retorne confidence "high". Se estiver em dúvida, retorne "low".`;

   return fromPromise(
      chat({
         adapter: openRouterText(model),
         messages: [
            { role: "user", content: [{ type: "text", content: prompt }] },
         ],
         outputSchema,
         stream: false,
      }).then(
         (result): { tagId: string; confidence: "high" | "low" } | null => {
            if (!result.tagName) return null;
            const match = tagOptions.find((t) => t.name === result.tagName);
            if (!match) return null;
            return { tagId: match.id, confidence: result.confidence };
         },
      ),
      (e) =>
         AppError.internal("Falha na inferência de centro de custo por IA.", {
            cause: e,
         }),
   );
}
