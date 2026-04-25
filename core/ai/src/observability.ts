import type { PostHog } from "@core/posthog/server";

export type AiObservabilityContext = {
   posthog: PostHog;
   distinctId: string;
   promptName?: string;
   promptVersion?: number;
};
