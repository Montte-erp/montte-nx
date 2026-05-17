import type { PostHog, Prompts } from "@core/posthog/server";

export async function setupAgentsWorkflows(deps: {
   posthog: PostHog;
   prompts: Prompts;
   workerConcurrency: number;
}) {
   void deps;
   return [];
}
