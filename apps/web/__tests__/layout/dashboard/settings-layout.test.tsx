// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@core/environment/web", () => ({
   env: {
      DATABASE_URL: "postgres://localhost/test",
      MINIO_ENDPOINT: "http://localhost:9000",
      MINIO_ACCESS_KEY: "test",
      MINIO_SECRET_KEY: "test",
      ARCJET_KEY: "test",
      ARCJET_ENV: "development",
      POSTHOG_KEY: "test",
      POSTHOG_HOST: "http://localhost",
      PG_VECTOR_URL: "postgres://localhost/test",
      BETTER_AUTH_SECRET: "test",
      BETTER_AUTH_URL: "http://localhost:3000",
      RESEND_API_KEY: "test",
      STRIPE_SECRET_KEY: "test",
      STRIPE_WEBHOOK_SECRET: "test",
      REDIS_URL: "redis://localhost:6379",
   },
}));
vi.mock("@core/files/client", () => ({
   minioClient: {},
}));
vi.mock("@core/posthog/server", () => ({
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));
vi.mock("@packages/agents", () => ({
   mastra: { getAgent: vi.fn() },
   createRequestContext: vi.fn(),
}));
vi.mock("@core/database/client", () => ({
   db: {},
}));
vi.mock("@core/redis/connection", () => ({
   redis: {},
}));
vi.mock("@core/authentication/server", () => ({
   auth: { api: {} },
}));
vi.mock("@core/stripe", () => ({
   stripeClient: {},
}));
vi.mock("@core/transactional/utils", () => ({
   resendClient: {},
}));

import { SettingsLayout } from "@/layout/dashboard/ui/settings-layout";

vi.mock("@packages/ui/hooks/use-mobile", () => ({
   useIsMobile: () => false,
}));

vi.mock("@packages/ui/components/sidebar", () => ({
   Sidebar: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   SidebarContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   SidebarHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   SidebarInset: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   SidebarManager: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
   SidebarProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
   ),
}));

vi.mock("@tanstack/react-router", () => ({
   useLocation: () => ({ pathname: "/acme/settings" }),
   useParams: () => ({ slug: "acme", teamSlug: "team-1" }),
   Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/hooks/use-active-organization", () => ({
   useActiveOrganization: () => ({
      activeOrganization: {
         id: "org-1",
         name: "Acme",
         slug: "acme",
      },
      activeSubscription: null,
   }),
}));

vi.mock("@/layout/dashboard/ui/settings-sidebar", () => ({
   SettingsSidebar: () => <div>Settings Sidebar</div>,
}));

describe("SettingsLayout", () => {
   it("renders settings sidebar and children", () => {
      render(
         <SettingsLayout>
            <div>Settings Content</div>
         </SettingsLayout>,
      );

      expect(screen.getByText("Settings Sidebar")).toBeTruthy();
      expect(screen.getByText("Settings Content")).toBeTruthy();
   });
});
