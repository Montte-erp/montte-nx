import { Prompts } from "@posthog/ai";
import { fromPromise } from "neverthrow";
import { env } from "@core/environment/web";

export const POSTHOG_PROMPTS = {
   categorizeTransaction: "montte-categorize-transaction",
   deriveKeywords: "montte-derive-keywords",
   suggestTag: "montte-suggest-tag",
} as const;

export type PromptKey = keyof typeof POSTHOG_PROMPTS;

const client = new Prompts({
   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
   projectApiKey: env.POSTHOG_KEY,
   host: env.POSTHOG_HOST,
});

export function compileSystemPrompt(
   promptKey: PromptKey,
   vars: Record<string, string>,
) {
   const name = POSTHOG_PROMPTS[promptKey];
   return fromPromise(
      client.get(name).then((template) => client.compile(template, vars)),
      (e) => new Error(`Failed to fetch prompt "${name}"`, { cause: e }),
   );
}
