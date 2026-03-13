import { PostHog } from "posthog-node";
export type { PostHog };
export declare function createPostHog(key: string, host: string): PostHog;
export type IdentifyUserProps = {
   email?: string;
   name?: string;
   [key: string]: unknown;
};
export declare function identifyUser(
   posthog: PostHog,
   userId: string,
   props?: IdentifyUserProps,
): void;
export type SetGroupProps = {
   slug?: string;
   name?: string;
   [key: string]: unknown;
};
export declare function setGroup(
   posthog: PostHog,
   organizationId: string,
   props?: SetGroupProps,
): void;
export type CaptureErrorProps = {
   userId: string;
   organizationId?: string;
   errorId: string;
   path: string;
   code: string;
   message: string;
   input?: unknown;
};
export declare function captureError(
   posthog: PostHog,
   props: CaptureErrorProps,
): void;
export type FeatureFlagContext = {
   userId: string;
   userProperties?: Record<string, string>;
   groups?: Record<string, string>;
   groupProperties?: Record<string, Record<string, string>>;
};
export declare function isFeatureEnabled(
   posthog: PostHog,
   flagKey: string,
   context: FeatureFlagContext,
): Promise<boolean>;
export declare function getFeatureFlag(
   posthog: PostHog,
   flagKey: string,
   context: FeatureFlagContext,
): Promise<string | boolean | undefined>;
export declare function getFeatureFlagPayload(
   posthog: PostHog,
   flagKey: string,
   userId: string,
   matchValue?: string | boolean,
): Promise<unknown>;
export declare function getAllFeatureFlags(
   posthog: PostHog,
   context: FeatureFlagContext,
): Promise<Record<string, string | boolean>>;
export declare function getAllFeatureFlagsAndPayloads(
   posthog: PostHog,
   context: FeatureFlagContext,
): Promise<{
   featureFlagPayloads: {
      [key: string]: import("@posthog/core").JsonType;
   };
   featureFlags: {
      [key: string]: import("@posthog/core").FeatureFlagValue;
   };
}>;
export type CaptureServerEventProps = {
   userId: string;
   event: string;
   properties?: Record<string, unknown>;
   groups?: Record<string, string>;
   timestamp?: Date;
};
export declare function captureServerEvent(
   posthog: PostHog,
   props: CaptureServerEventProps,
): void;
export declare function shutdownPosthog(posthog: PostHog): Promise<void>;
//# sourceMappingURL=server.d.ts.map
