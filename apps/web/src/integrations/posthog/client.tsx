import type { WebClientEnv } from "@core/environment/web";
import { isClientProduction } from "@core/environment/helpers";
import { PostHogProvider } from "posthog-js/react";

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

type PosthogEnv = Pick<WebClientEnv, "VITE_POSTHOG_HOST" | "VITE_POSTHOG_KEY">;

function getReactPosthogConfig(env: PosthogEnv) {
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
   env: PosthogEnv;
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
