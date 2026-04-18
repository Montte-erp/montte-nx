import { PostHog } from "posthog-node";
import { Prompts } from "@posthog/ai";
import { env } from "@core/environment/web";

export const promptsClient = new Prompts({
   personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
   projectApiKey: env.POSTHOG_KEY,
   host: env.POSTHOG_HOST,
});

export type { PostHog };

export function createPostHog(key: string, host: string): PostHog {
   return new PostHog(key, {
      flushAt: 20,
      flushInterval: 10000,
      host,
      enableExceptionAutocapture: true,
   });
}

export type IdentifyUserProps = {
   email?: string;
   name?: string;
   [key: string]: unknown;
};

export function identifyUser(
   posthog: PostHog,
   userId: string,
   props: IdentifyUserProps = {},
) {
   posthog.identify({
      distinctId: userId,
      properties: props,
   });
}

export type SetGroupProps = {
   slug?: string;
   name?: string;
   [key: string]: unknown;
};

export function setGroup(
   posthog: PostHog,
   organizationId: string,
   props: SetGroupProps = {},
) {
   posthog.groupIdentify({
      groupKey: organizationId,
      groupType: "organization",
      properties: props,
   });
}

export type CaptureErrorProps = {
   userId: string;
   organizationId?: string;
   errorId: string;
   path: string;
   code: string;
   message: string;
   input?: unknown;
};

export function captureError(posthog: PostHog, props: CaptureErrorProps) {
   const { userId, organizationId, errorId, path, code, message, input } =
      props;
   posthog.capture({
      distinctId: userId,
      event: "orpc_error",
      properties: {
         code,
         errorId,
         input,
         message,
         path,
      },
      groups: organizationId ? { organization: organizationId } : undefined,
   });
}

export type FeatureFlagContext = {
   userId: string;
   userProperties?: Record<string, string>;
   groups?: Record<string, string>;
   groupProperties?: Record<string, Record<string, string>>;
};

export async function isFeatureEnabled(
   posthog: PostHog,
   flagKey: string,
   context: FeatureFlagContext,
): Promise<boolean> {
   const result = await posthog.isFeatureEnabled(flagKey, context.userId, {
      groupProperties: context.groupProperties,
      groups: context.groups,
      personProperties: context.userProperties,
   });
   return result ?? false;
}

export async function getFeatureFlag(
   posthog: PostHog,
   flagKey: string,
   context: FeatureFlagContext,
): Promise<string | boolean | undefined> {
   return posthog.getFeatureFlag(flagKey, context.userId, {
      groupProperties: context.groupProperties,
      groups: context.groups,
      personProperties: context.userProperties,
   });
}

export async function getFeatureFlagPayload(
   posthog: PostHog,
   flagKey: string,
   userId: string,
   matchValue?: string | boolean,
): Promise<unknown> {
   return posthog.getFeatureFlagPayload(flagKey, userId, matchValue);
}

export async function getAllFeatureFlags(
   posthog: PostHog,
   context: FeatureFlagContext,
): Promise<Record<string, string | boolean>> {
   return posthog.getAllFlags(context.userId, {
      groupProperties: context.groupProperties,
      groups: context.groups,
      personProperties: context.userProperties,
   });
}

export async function getAllFeatureFlagsAndPayloads(
   posthog: PostHog,
   context: FeatureFlagContext,
) {
   const result = await posthog.getAllFlagsAndPayloads(context.userId, {
      groupProperties: context.groupProperties,
      groups: context.groups,
      personProperties: context.userProperties,
   });
   return {
      featureFlagPayloads: result.featureFlagPayloads ?? {},
      featureFlags: result.featureFlags ?? {},
   };
}

export type CaptureServerEventProps = {
   userId: string;
   event: string;
   properties?: Record<string, unknown>;
   groups?: Record<string, string>;
   timestamp?: Date;
};

export function captureServerEvent(
   posthog: PostHog,
   props: CaptureServerEventProps,
) {
   const { userId, event, properties, groups, timestamp } = props;
   const safeProperties = properties ?? {};
   posthog.capture({
      distinctId: userId,
      event,
      properties: safeProperties,
      groups,
      timestamp,
   });
}

export async function shutdownPosthog(posthog: PostHog): Promise<void> {
   await posthog.shutdown();
}
