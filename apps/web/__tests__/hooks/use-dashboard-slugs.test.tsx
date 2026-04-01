// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
   useDashboardSlugs,
   useOrgSlug,
   useTeamSlug,
} from "@/hooks/use-dashboard-slugs";

vi.mock("@tanstack/react-router", () => ({
   useParams: ({
      select,
   }: {
      select: (p: { slug: string; teamSlug: string }) => unknown;
   }) => select({ slug: "acme", teamSlug: "team-1" }),
}));

describe("useOrgSlug", () => {
   it("returns the org slug", () => {
      const { result } = renderHook(() => useOrgSlug());
      expect(result.current).toBe("acme");
   });
});

describe("useTeamSlug", () => {
   it("returns the team slug", () => {
      const { result } = renderHook(() => useTeamSlug());
      expect(result.current).toBe("team-1");
   });
});

describe("useDashboardSlugs", () => {
   it("returns both slugs in a single call", () => {
      const { result } = renderHook(() => useDashboardSlugs());
      expect(result.current).toEqual({ slug: "acme", teamSlug: "team-1" });
   });
});
