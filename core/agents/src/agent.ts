import { chat, type ChatMiddleware } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import type { DatabaseInstance } from "@core/database/client";
import * as chatRepo from "@core/database/repositories/chat-repository";
import {
   AVAILABLE_MODELS,
   DEFAULT_CONTENT_MODEL_ID,
   type ModelId,
} from "@core/agents/models";
import { buildLanguageInstruction } from "@core/agents/utils";

export type ChatRubiOptions = {
   db: DatabaseInstance;
   userId: string;
   teamId: string;
   organizationId: string;
   threadId: string;
   messages: unknown[];
   modelId?: string;
   language?: string;
   thinkingBudget?: number;
};

function buildSystemPrompt(language: string): string {
   const languageInstruction = buildLanguageInstruction(language ?? "pt-BR");
   return `${languageInstruction}

# RUBI — ASSISTENTE MONTTE

Você é a Rubi, assistente de IA da Montte — um ERP financeiro para pequenas e médias empresas.
Seu nome é inspirado no beijaflor gravatinha vermelha, mascote da Montte.

## SUAS CAPACIDADES

Você pode ajudar os usuários com:
- Dúvidas sobre finanças, contabilidade e gestão empresarial
- Orientações sobre funcionalidades da plataforma (transações, contas, categorias, metas, etc.)
- Análise e interpretação de dados financeiros
- Sugestões de organização financeira e orçamento

## COMPORTAMENTO

- Seja direto e objetivo nas respostas
- Use linguagem acessível, evitando jargões desnecessários
- Quando não souber algo específico do contexto do usuário, pergunte
- Nunca invente dados financeiros — trabalhe apenas com informações fornecidas`;
}

function createPersistenceMiddleware(
   db: DatabaseInstance,
   threadId: string,
   userMessages: unknown[],
   language: string,
): ChatMiddleware {
   return {
      name: "montte-persistence",
      onStart: async () => {
         const lastUser = [...userMessages]
            .reverse()
            .find((m) => (m as { role: string }).role === "user") as
            | { role: string; parts: unknown; id?: string }
            | undefined;
         if (lastUser) {
            await chatRepo.appendMessages(db, threadId, [
               {
                  id: crypto.randomUUID(),
                  role: "user",
                  parts: lastUser.parts ?? [],
               },
            ]);
         }
      },
      onFinish: async (_ctx, info) => {
         await chatRepo.appendMessages(db, threadId, [
            {
               id: crypto.randomUUID(),
               role: "assistant",
               parts: [{ type: "text", content: info.content }],
            },
         ]);
         void generateThreadTitle(db, threadId, userMessages, language);
      },
   };
}

export function chatRubi({
   db,
   threadId,
   messages,
   modelId,
   language = "pt-BR",
}: ChatRubiOptions) {
   const resolvedModelId: ModelId =
      modelId && modelId in AVAILABLE_MODELS
         ? (modelId as ModelId)
         : DEFAULT_CONTENT_MODEL_ID;
   const preset = AVAILABLE_MODELS[resolvedModelId];

   const adapterModelId = resolvedModelId.replace(
      /^openrouter\//,
      "",
   ) as Parameters<typeof openRouterText>[0];

   return chat({
      adapter: openRouterText(adapterModelId),
      messages: messages as Parameters<typeof chat>[0]["messages"],
      systemPrompts: [buildSystemPrompt(language)],
      temperature: preset.temperature,
      topP: preset.topP,
      maxTokens: preset.maxTokens,
      middleware: [
         createPersistenceMiddleware(db, threadId, messages, language),
      ],
   });
}

async function generateThreadTitle(
   db: DatabaseInstance,
   threadId: string,
   messages: unknown[],
   language: string,
): Promise<void> {
   const thread = await chatRepo.getThreadById(db, threadId);
   if (!thread || thread.title) return;
   const firstUser = messages.find(
      (m) => (m as { role: string }).role === "user",
   ) as { parts?: Array<{ type: string; content?: string }> } | undefined;
   if (!firstUser) return;
   const textPart = firstUser.parts?.find((p) => p.type === "text");
   if (!textPart?.content) return;
   try {
      const titleAdapter = openRouterText("qwen/qwen3-8b");
      const prompt = `Generate a short title (max 6 words, no punctuation) in ${language} for: "${textPart.content.slice(0, 200)}"`;
      const titleStream = chat({
         adapter: titleAdapter,
         messages: [{ role: "user" as const, content: prompt }],
         maxTokens: 20,
      });
      let title = "";
      for await (const chunk of titleStream) {
         if (chunk.type === "TEXT_MESSAGE_CONTENT" && "delta" in chunk) {
            title += (chunk as { delta: string }).delta;
         }
         if (chunk.type === "RUN_FINISHED") break;
      }
      if (title.trim()) {
         await chatRepo.updateThreadTitle(db, threadId, title.trim());
      }
   } catch {
      // best-effort
   }
}
