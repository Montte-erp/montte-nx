import { Prompts } from "@posthog/ai";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { env } from "@core/environment/web";

export const POSTHOG_PROMPTS = {
   categorizeTransaction: {
      name: "montte-categorize-transaction",
      vars: z.object({ category_list: z.string().min(1) }),
   },
   deriveKeywords: {
      name: "montte-derive-keywords",
      vars: z.object({}),
   },
   suggestTag: {
      name: "montte-suggest-tag",
      vars: z.object({ tag_list: z.string().min(1) }),
   },
} as const satisfies Record<
   string,
   { name: string; vars: z.ZodObject<z.ZodRawShape> }
>;

export type PromptKey = keyof typeof POSTHOG_PROMPTS;

const client = new Prompts({
   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
   projectApiKey: env.POSTHOG_KEY,
   host: env.POSTHOG_HOST,
});

export function compileSystemPrompt<K extends PromptKey>(
   promptKey: K,
   vars: z.infer<(typeof POSTHOG_PROMPTS)[K]["vars"]>,
) {
   const { name, vars: schema } = POSTHOG_PROMPTS[promptKey];
   const parsed = schema.safeParse(vars);
   if (!parsed.success) {
      return fromPromise(
         Promise.reject(
            new Error(
               `Invalid vars for prompt "${name}": ${parsed.error.message}`,
            ),
         ),
         (e) => e as Error,
      );
   }
   return fromPromise(
      client
         .get(name)
         .then((template) => client.compile(template, parsed.data)),
      (e) => new Error(`Failed to fetch prompt "${name}"`, { cause: e }),
   );
}
