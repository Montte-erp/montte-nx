import process from "node:process";
import { Result, TaggedError } from "better-result";
import { z } from "zod";

const OPENCODE_GO_ENDPOINT = "https://opencode.ai/zen/go/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";

const openCodeGoResponseSchema = z.object({
   choices: z
      .array(
         z.object({
            message: z
               .object({
                  content: z.string().optional(),
               })
               .optional(),
            text: z.string().optional(),
         }),
      )
      .optional(),
   error: z
      .object({
         message: z.string().optional(),
      })
      .optional(),
});

export class OpenCodeGoError extends TaggedError("OpenCodeGoError")<{
   message: string;
   cause?: unknown;
}>() {}

export async function runOpenCodeGo(prompt: string, model = DEFAULT_MODEL) {
   const apiKey = process.env.OPENCODE_API_KEY;

   if (!apiKey) {
      return Result.err(
         new OpenCodeGoError({
            message: "OPENCODE_API_KEY não configurada no ambiente.",
         }),
      );
   }

   const responseResult = await Result.tryPromise({
      try: () =>
         fetch(OPENCODE_GO_ENDPOINT, {
            method: "POST",
            headers: {
               Authorization: `Bearer ${apiKey}`,
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               model,
               temperature: 0.2,
               messages: [{ role: "user", content: prompt }],
            }),
         }),
      catch: (cause) =>
         new OpenCodeGoError({
            message: "Falha ao chamar OpenCode Go.",
            cause,
         }),
   });
   if (Result.isError(responseResult)) return Result.err(responseResult.error);

   if (!responseResult.value.ok) {
      const errorBody = await Result.tryPromise({
         try: () => responseResult.value.text(),
         catch: (cause) =>
            new OpenCodeGoError({
               message: "Falha ao ler erro do OpenCode Go.",
               cause,
            }),
      });

      return Result.err(
         new OpenCodeGoError({
            message: `OpenCode Go retornou ${responseResult.value.status}: ${
               Result.isOk(errorBody) ? errorBody.value : "sem corpo de erro"
            }`,
            cause: Result.isError(errorBody) ? errorBody.error : undefined,
         }),
      );
   }

   const jsonResult = await Result.tryPromise({
      try: () => responseResult.value.json(),
      catch: (cause) =>
         new OpenCodeGoError({
            message: "Falha ao ler resposta do OpenCode Go.",
            cause,
         }),
   });
   if (Result.isError(jsonResult)) return Result.err(jsonResult.error);

   const parsed = openCodeGoResponseSchema.safeParse(jsonResult.value);
   if (!parsed.success) {
      return Result.err(
         new OpenCodeGoError({
            message: "Resposta do OpenCode Go não segue o formato esperado.",
            cause: parsed.error,
         }),
      );
   }

   if (parsed.data.error?.message) {
      return Result.err(
         new OpenCodeGoError({
            message: `OpenCode Go: ${parsed.data.error.message}`,
         }),
      );
   }

   const choice = parsed.data.choices?.at(0);
   const content = choice?.message?.content ?? choice?.text;

   if (!content?.trim()) {
      return Result.err(
         new OpenCodeGoError({
            message: "OpenCode Go retornou conteúdo vazio.",
         }),
      );
   }

   return Result.ok(content.trim());
}

export { DEFAULT_MODEL };
