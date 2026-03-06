import type { ClientEnv } from "@packages/environment/client";
import { isClientProduction } from "@packages/environment/helpers";
import posthog from "posthog-js";
import { PostHogProvider, usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export type EarlyAccessStage =
   | "alpha"
   | "beta"
   | "concept"
   | "general-availability";

export type EarlyAccessFeature = {
   name: string;
   description: string;
   stage: EarlyAccessStage;
   documentationUrl: string | null;
   flagKey: string | null;
};

export function normalizeEarlyAccessStage(
   raw: string | undefined,
): EarlyAccessStage {
   if (raw === "general availability / archived") return "general-availability";
   if (
      raw === "alpha" ||
      raw === "beta" ||
      raw === "concept" ||
      raw === "general-availability"
   ) {
      return raw;
   }
   return "beta";
}

// ── Provider ─────────────────────────────────────────────────────────────────

type PosthogEnv = Pick<ClientEnv, "VITE_POSTHOG_HOST" | "VITE_POSTHOG_KEY">;

function getReactPosthogConfig(env: PosthogEnv) {
   return {
      api_host: env.VITE_POSTHOG_HOST,
      api_key: env.VITE_POSTHOG_KEY,
      autocapture: true,
      capture_pageleave: true,
      capture_pageview: false,
      capture_performance: true,
      enable_exception_autocapture: true,
   };
}

export function PostHogWrapper({
   children,
   env,
   hasConsent = true,
}: {
   children: React.ReactNode;
   env: PosthogEnv;
   hasConsent?: boolean;
}) {
   return (
      <PostHogProvider
         apiKey={env.VITE_POSTHOG_KEY}
         options={{
            ...getReactPosthogConfig(env),
            disable_session_recording: !isClientProduction,
            opt_out_capturing_by_default: !hasConsent,
         }}
      >
         {children}
      </PostHogProvider>
   );
}

// ── Tracking ─────────────────────────────────────────────────────────────────

export function identifyClient(
   userId: string,
   properties?: Record<string, unknown>,
   propertiesOnce?: Record<string, unknown>,
) {
   posthog.identify(userId, properties, propertiesOnce);
}

export function setClientGroup(
   groupType: string,
   groupKey: string,
   properties?: Record<string, unknown>,
) {
   posthog.group(groupType, groupKey, properties);
}

export function captureClientEvent(
   name: string,
   props: Record<string, unknown> = {},
) {
   posthog.capture(name, props);
}

type RouterLocation = {
   href: string;
   pathname: string;
   search: string | Record<string, unknown>;
};

export function usePosthogRouterTracking(location: RouterLocation) {
   const posthogClient = usePostHog();
   const [previousPath, setPreviousPath] = useState<string | null>(null);

   useEffect(() => {
      if (previousPath !== location.pathname) {
         const searchString =
            typeof location.search === "string"
               ? location.search
               : JSON.stringify(location.search);
         posthogClient.capture("$pageview", {
            $current_url: location.href,
            $pathname: location.pathname,
            $referrer: previousPath
               ? `${window.location.origin}${previousPath}`
               : document.referrer,
            $search: searchString,
         });
         setPreviousPath(location.pathname);
      }
   }, [
      posthogClient,
      location.href,
      location.pathname,
      location.search,
      previousPath,
   ]);
}

export function PosthogRouterTracker({
   location,
}: {
   location: RouterLocation;
}) {
   usePosthogRouterTracking(location);
   return null;
}

export { usePostHog };
