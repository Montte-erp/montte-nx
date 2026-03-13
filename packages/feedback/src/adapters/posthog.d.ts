import type { FeedbackAdapter } from "../schemas";
type PostHogLike = {
   capture: (event: {
      distinctId: string;
      event: string;
      properties?: Record<string, unknown>;
   }) => void;
};
type PostHogAdapterConfig = {
   posthog: PostHogLike;
};
export declare function posthogAdapter(
   config: PostHogAdapterConfig,
): FeedbackAdapter;
export {};
//# sourceMappingURL=posthog.d.ts.map
