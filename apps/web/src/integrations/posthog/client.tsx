import { isClientProduction } from "@core/environment/helpers";
import type { PublicEnv } from "@/integrations/public-env";
import posthog, { type PostHog } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { createClientOnlyFn } from "@tanstack/react-start";

export type EarlyAccessStage =
   | "alpha"
   | "beta"
   | "concept"
   | "general-availability";

export type EarlyAccessFeature = {
   name: string;
   description: string;
   stage: EarlyAccessStage | null;
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

export const getPosthogClient = createClientOnlyFn((): PostHog => posthog);

function getReactPosthogConfig(env: PublicEnv) {
   return {
      api_host: env.VITE_POSTHOG_HOST,
      api_key: env.VITE_POSTHOG_KEY,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      capture_performance: true,
      enable_exception_autocapture: true,
      disable_session_recording: !isClientProduction,
      feature_flag_request_timeout_ms: 3000,
      opt_in_site_apps: true,
      persistence: "localStorage" as const,
   };
}

export function PostHogWrapper({
   children,
   env,
}: {
   children: React.ReactNode;
   env: PublicEnv;
}) {
   return (
      <PostHogProvider
         apiKey={env.VITE_POSTHOG_KEY}
         options={getReactPosthogConfig(env)}
      >
         {children}
      </PostHogProvider>
   );
}
