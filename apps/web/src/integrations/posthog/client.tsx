import type { PublicEnv } from "@/integrations/public-env";
import type { PostHogConfig } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

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

function getReactPosthogConfig(env: PublicEnv): Partial<PostHogConfig> {
   return {
      api_host: env.POSTHOG_HOST,
      defaults: "2026-01-30",
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      capture_performance: { web_vitals: true, network_timing: true },
      capture_exceptions: true,
      disable_session_recording: false,
      session_recording: {
         maskAllInputs: false,
         maskInputOptions: { password: true, email: false },
      },
      feature_flag_request_timeout_ms: 3000,
      opt_in_site_apps: true,
      persistence: "localStorage",
   };
}

export function PostHogWrapper({
   children,
   env,
}: {
   children: React.ReactNode;
   env: PublicEnv | undefined;
}) {
   if (!env) return <>{children}</>;
   return (
      <PostHogProvider
         apiKey={env.POSTHOG_KEY}
         options={getReactPosthogConfig(env)}
      >
         {children}
      </PostHogProvider>
   );
}
