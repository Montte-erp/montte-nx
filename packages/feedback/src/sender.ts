import { Octokit } from "@octokit/rest";
import { getLogger } from "@core/logging/root";
import type { PostHog } from "@core/posthog/server";

import { discordAdapter } from "./adapters/discord";
import { githubAdapter } from "./adapters/github";
import { posthogAdapter } from "./adapters/posthog";
import type { FeedbackAdapter, FeedbackMessage } from "./schemas";

const logger = getLogger().child({ module: "feedback" });

export interface CreateFeedbackSenderOpts {
   posthog: PostHog;
   discordWebhookUrl?: string;
   githubToken?: string;
   githubOwner?: string;
   githubRepo?: string;
}

export function createFeedbackSender(opts: CreateFeedbackSenderOpts) {
   const adapters: FeedbackAdapter[] = [
      posthogAdapter({ posthog: opts.posthog }),
   ];

   if (opts.discordWebhookUrl) {
      adapters.push(discordAdapter({ webhookUrl: opts.discordWebhookUrl }));
   }

   if (opts.githubToken && opts.githubOwner && opts.githubRepo) {
      adapters.push(
         githubAdapter({
            octokit: new Octokit({ auth: opts.githubToken }),
            owner: opts.githubOwner,
            repo: opts.githubRepo,
         }),
      );
   }

   return {
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
}
