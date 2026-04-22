import { chat, toolDefinition, toServerSentEventsStream } from "@tanstack/ai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { z } from "zod";
import { e2b } from "@computesdk/e2b";
import { compute } from "computesdk";
import { buildLanguageInstruction } from "./utils";

type OpenRouterModelId = Parameters<typeof createOpenRouterText>[0];

const DEFAULT_MODEL: OpenRouterModelId = "moonshotai/kimi-k2.5";

export type ChatMessage = {
   role: "user" | "assistant";
   content: string;
};

export type ChatRubiOptions = {
   messages: ChatMessage[];
   montteApiKey: string;
   openRouterApiKey: string;
   e2bApiKey: string;
   modelId?: OpenRouterModelId;
   language?: string;
   montteHost?: string;
};

const SYSTEM_PROMPT = `Você é a Rubi, assistente de inteligência artificial do Montte ERP.
Você tem acesso ao CLI do Montte autenticado como o próprio usuário.
Use as ferramentas disponíveis para consultar e gerenciar dados financeiros: transações, contas bancárias, categorias, orçamentos e mais.
Sempre responda de forma clara, objetiva e em português brasileiro.
Ao apresentar valores monetários, use o formato brasileiro (R$ 1.234,56).
Ao apresentar datas, use o formato DD/MM/AAAA.
Quando executar comandos, interprete e resuma os resultados de forma amigável — nunca exiba JSON bruto ao usuário.`;

export function chatRubi(options: ChatRubiOptions) {
   const {
      messages,
      montteApiKey,
      openRouterApiKey,
      e2bApiKey,
      modelId = DEFAULT_MODEL,
      language = "pt-BR",
      montteHost,
   } = options;

   const scopedCompute = compute({
      provider: e2b({ apiKey: e2bApiKey }),
   });

   const runMontteCommand = toolDefinition({
      name: "run_montte_command",
      description:
         "Executa um comando do Montte CLI autenticado como o usuário. " +
         "Use para consultar transações, contas bancárias, categorias, orçamentos e outros dados do ERP. " +
         "Exemplos: args='transactions list --from 2025-01-01', args='accounts list', args='categories list'",
      inputSchema: z.object({
         args: z
            .string()
            .describe(
               "Argumentos do comando montte (sem o prefixo 'montte'). Ex: 'transactions list --from 2025-01-01 --to 2025-03-31'",
            ),
      }),
   }).server(async ({ args }) => {
      const sandbox = await scopedCompute.sandbox.create();

      const env: Record<string, string> = {
         MONTTE_API_KEY: montteApiKey,
         ...(montteHost ? { MONTTE_HOST: montteHost } : {}),
      };

      const result = await sandbox.runCommand(
         `npx --yes @montte/cli@latest ${args} --json`,
         { env },
      );

      await sandbox.destroy();

      if (result.exitCode !== 0) {
         return { success: false, error: result.stderr };
      }

      return { success: true, output: result.stdout };
   });

   const stream = chat({
      adapter: createOpenRouterText(modelId, openRouterApiKey),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      systemPrompts: [SYSTEM_PROMPT, buildLanguageInstruction(language)],
      tools: [runMontteCommand],
      stream: true,
   });

   return toServerSentEventsStream(stream);
}
