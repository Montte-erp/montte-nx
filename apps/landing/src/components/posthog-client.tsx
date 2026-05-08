import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from "astro:env/client";
import posthog from "posthog-js";
import { useEffect } from "react";

let initialized = false;

export function PostHogClient() {
   useEffect(() => {
      if (initialized || !PUBLIC_POSTHOG_KEY) return;
      posthog.init(PUBLIC_POSTHOG_KEY, {
         api_host: PUBLIC_POSTHOG_HOST,
         capture_pageview: true,
         capture_pageleave: true,
         person_profiles: "always",
         session_recording: { maskAllInputs: false },
      });
      initialized = true;
   }, []);
   return null;
}
