import { Octokit } from "@octokit/rest";
import { env } from "@core/environment/web/server";
import { getLogger } from "@core/logging/root";
import { posthog } from "@core/posthog/server";

import { discordAdapter } from "./adapters/discord";
import { githubAdapter } from "./adapters/github";
import { posthogAdapter } from "./adapters/posthog";
import type { FeedbackAdapter, FeedbackMessage } from "./schemas";

const logger = getLogger().child({ module: "feedback" });

function createAdapters(): FeedbackAdapter[] {
   const adapters: FeedbackAdapter[] = [posthogAdapter({ posthog })];

   if (env.DISCORD_FEEDBACK_WEBHOOK_URL) {
      adapters.push(
         discordAdapter({ webhookUrl: env.DISCORD_FEEDBACK_WEBHOOK_URL }),
      );
   }

   if (
      env.GITHUB_FEEDBACK_TOKEN &&
      env.GITHUB_FEEDBACK_OWNER &&
      env.GITHUB_FEEDBACK_REPO
   ) {
      adapters.push(
         githubAdapter({
            octokit: new Octokit({ auth: env.GITHUB_FEEDBACK_TOKEN }),
            owner: env.GITHUB_FEEDBACK_OWNER,
            repo: env.GITHUB_FEEDBACK_REPO,
         }),
      );
   }

   return adapters;
}

const adapters = createAdapters();

export const feedbackSender = {
   async send(message: FeedbackMessage): Promise<void> {
      const results = await Promise.allSettled(
         adapters.map((adapter) => adapter.send(message)),
      );

      for (const [index, result] of results.entries()) {
         if (result.status === "rejected") {
            logger.error(
               { adapter: adapters[index]?.name, err: result.reason },
               "Adapter failed",
            );
         }
      }
   },
};
