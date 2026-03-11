import { vi } from "vitest";
import type { PostHog } from "posthog-node";

export function createMockPostHog() {
   return {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      isFeatureEnabled: vi
         .fn<() => Promise<boolean | undefined>>()
         .mockResolvedValue(false),
      getFeatureFlag: vi
         .fn<() => Promise<string | boolean | undefined>>()
         .mockResolvedValue(undefined),
      getFeatureFlagPayload: vi
         .fn<() => Promise<unknown>>()
         .mockResolvedValue(undefined),
      getAllFlags: vi
         .fn<() => Promise<Record<string, string | boolean>>>()
         .mockResolvedValue({}),
      getAllFlagsAndPayloads: vi
         .fn<
            () => Promise<{
               featureFlags: Record<string, string | boolean>;
               featureFlagPayloads: Record<string, unknown>;
            }>
         >()
         .mockResolvedValue({
            featureFlags: {},
            featureFlagPayloads: {},
         }),
   } as unknown as PostHog & {
      capture: ReturnType<typeof vi.fn>;
      identify: ReturnType<typeof vi.fn>;
      groupIdentify: ReturnType<typeof vi.fn>;
      shutdown: ReturnType<typeof vi.fn>;
      isFeatureEnabled: ReturnType<typeof vi.fn>;
      getFeatureFlag: ReturnType<typeof vi.fn>;
      getFeatureFlagPayload: ReturnType<typeof vi.fn>;
      getAllFlags: ReturnType<typeof vi.fn>;
      getAllFlagsAndPayloads: ReturnType<typeof vi.fn>;
   };
}
