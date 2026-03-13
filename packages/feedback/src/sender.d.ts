import type { PostHog } from "@core/posthog/server";
import type { FeedbackMessage } from "./schemas";
export interface CreateFeedbackSenderOpts {
   posthog: PostHog;
   discordWebhookUrl?: string;
   githubToken?: string;
   githubOwner?: string;
   githubRepo?: string;
}
export declare function createFeedbackSender(opts: CreateFeedbackSenderOpts): {
   send(message: FeedbackMessage): Promise<void>;
};
//# sourceMappingURL=sender.d.ts.map
