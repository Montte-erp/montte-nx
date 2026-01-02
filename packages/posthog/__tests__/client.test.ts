import { describe, expect, it } from "bun:test";
import { getAstroPosthogConfig, getReactPosthogConfig } from "../src/client";

describe("posthog client", () => {
   const mockEnv = {
      VITE_POSTHOG_HOST: "https://e.example.com",
      VITE_POSTHOG_KEY: "phc_test_key_123",
      VITE_POSTHOG_UI_HOST: "https://us.posthog.com",
   };

   describe("getReactPosthogConfig", () => {
      it("should return config with api_host, api_key, and ui_host", () => {
         const config = getReactPosthogConfig(mockEnv);

         expect(config).toEqual({
            api_host: "https://e.example.com",
            api_key: "phc_test_key_123",
            autocapture: true,
            capture_pageleave: true,
            capture_pageview: false,
            capture_performance: true,
            ui_host: "https://us.posthog.com",
         });
      });

      it("should use values from env parameter", () => {
         const customEnv = {
            VITE_POSTHOG_HOST: "https://e.custom.com",
            VITE_POSTHOG_KEY: "phc_custom_key",
            VITE_POSTHOG_UI_HOST: "https://eu.posthog.com",
         };

         const config = getReactPosthogConfig(customEnv);

         expect(config.api_host).toBe("https://e.custom.com");
         expect(config.api_key).toBe("phc_custom_key");
         expect(config.ui_host).toBe("https://eu.posthog.com");
      });

      it("should handle reverse proxy URLs for api_host", () => {
         const proxyEnv = {
            VITE_POSTHOG_HOST: "https://analytics.mycompany.com",
            VITE_POSTHOG_KEY: "phc_self_hosted",
            VITE_POSTHOG_UI_HOST: "https://us.posthog.com",
         };

         const config = getReactPosthogConfig(proxyEnv);

         expect(config.api_host).toBe("https://analytics.mycompany.com");
         expect(config.ui_host).toBe("https://us.posthog.com");
      });

      it("should disable automatic pageview capture", () => {
         const config = getReactPosthogConfig(mockEnv);

         expect(config.capture_pageview).toBe(false);
      });

      it("should enable pageleave tracking", () => {
         const config = getReactPosthogConfig(mockEnv);

         expect(config.capture_pageleave).toBe(true);
      });

      it("should enable performance/web vitals capture", () => {
         const config = getReactPosthogConfig(mockEnv);

         expect(config.capture_performance).toBe(true);
      });

      it("should enable autocapture", () => {
         const config = getReactPosthogConfig(mockEnv);

         expect(config.autocapture).toBe(true);
      });
   });

   describe("getAstroPosthogConfig", () => {
      it("should return a string containing the posthog init script", () => {
         const script = getAstroPosthogConfig(mockEnv);

         expect(typeof script).toBe("string");
         expect(script).toContain("posthog.init");
      });

      it("should include the api key in the script", () => {
         const script = getAstroPosthogConfig(mockEnv);

         expect(script).toContain("phc_test_key_123");
      });

      it("should include the api host in the script", () => {
         const script = getAstroPosthogConfig(mockEnv);

         expect(script).toContain("https://e.example.com");
      });

      it("should include the ui host in the script", () => {
         const script = getAstroPosthogConfig(mockEnv);

         expect(script).toContain("ui_host:'https://us.posthog.com'");
      });

      it("should include defaults configuration", () => {
         const script = getAstroPosthogConfig(mockEnv);

         expect(script).toContain("defaults: '2025-05-24'");
      });

      it("should use custom env values", () => {
         const customEnv = {
            VITE_POSTHOG_HOST: "https://e.custom.com",
            VITE_POSTHOG_KEY: "phc_custom_astro_key",
            VITE_POSTHOG_UI_HOST: "https://eu.posthog.com",
         };

         const script = getAstroPosthogConfig(customEnv);

         expect(script).toContain("https://e.custom.com");
         expect(script).toContain("phc_custom_astro_key");
         expect(script).toContain("ui_host:'https://eu.posthog.com'");
      });

      it("should contain the posthog loader script", () => {
         const script = getAstroPosthogConfig(mockEnv);

         expect(script).toContain("window.posthog");
         expect(script).toContain("e.__SV");
      });
   });
});
