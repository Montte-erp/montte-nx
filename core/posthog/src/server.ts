import { env } from "@core/environment/server";
import { PostHog } from "posthog-node";

export type { PostHog };

export const posthog = new PostHog(env.POSTHOG_KEY, {
   flushAt: 20,
   flushInterval: 10000,
   host: env.POSTHOG_HOST,
   enableExceptionAutocapture: true,
});

export type IdentifyUserProps = {
   email?: string;
   name?: string;
   [key: string]: unknown;
};

export function identifyUser(userId: string, props: IdentifyUserProps = {}) {
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

export function setGroup(organizationId: string, props: SetGroupProps = {}) {
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

export function captureError(props: CaptureErrorProps) {
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
   flagKey: string,
   userId: string,
   matchValue?: string | boolean,
): Promise<unknown> {
   return posthog.getFeatureFlagPayload(flagKey, userId, matchValue);
}

export async function getAllFeatureFlags(
   context: FeatureFlagContext,
): Promise<Record<string, string | boolean>> {
   return posthog.getAllFlags(context.userId, {
      groupProperties: context.groupProperties,
      groups: context.groups,
      personProperties: context.userProperties,
   });
}

export async function getAllFeatureFlagsAndPayloads(
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

export function captureServerEvent(props: CaptureServerEventProps) {
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

export async function shutdownPosthog(): Promise<void> {
   await posthog.shutdown();
}
