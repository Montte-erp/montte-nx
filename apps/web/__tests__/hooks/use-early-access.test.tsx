// @vitest-environment jsdom
import { act, render, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("foxact/create-local-storage-state", () => ({
   createLocalStorageState: (_key: string, initial: unknown) => {
      const useHook = () => useState(initial);
      return [useHook];
   },
}));

const mockGetEarlyAccessFeatures = vi.fn();
const mockIsFeatureEnabled = vi.fn();
const mockUpdateEarlyAccessFeatureEnrollment = vi.fn();

vi.mock("posthog-js/react", () => ({
   usePostHog: () => ({
      getEarlyAccessFeatures: mockGetEarlyAccessFeatures,
      isFeatureEnabled: mockIsFeatureEnabled,
      updateEarlyAccessFeatureEnrollment: mockUpdateEarlyAccessFeatureEnrollment,
   }),
}));

import { EarlyAccessProvider, useEarlyAccess } from "@/hooks/use-early-access";

const rawFeatures = [
   { flagKey: "contatos", name: "Contatos", description: "Desc", stage: "beta", documentationUrl: null, payload: {} },
   { flagKey: "dados", name: "Dados", description: "Desc2", stage: "alpha", documentationUrl: null, payload: {} },
];

beforeEach(() => {
   mockGetEarlyAccessFeatures.mockReset();
   mockIsFeatureEnabled.mockReset();
   mockUpdateEarlyAccessFeatureEnrollment.mockReset();
});

describe("EarlyAccessProvider", () => {
   it("calls getEarlyAccessFeatures with all stages", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});

      render(<EarlyAccessProvider>x</EarlyAccessProvider>);

      expect(mockGetEarlyAccessFeatures).toHaveBeenCalledWith(
         expect.any(Function),
         true,
         ["concept", "alpha", "beta", "general-availability"],
      );
   });

   it("seeds enrolled keys from posthog.isFeatureEnabled", () => {
      mockIsFeatureEnabled.mockImplementation((key: string) => key === "contatos");
      mockGetEarlyAccessFeatures.mockImplementation((cb: (f: typeof rawFeatures) => void) => cb(rawFeatures));

      render(<EarlyAccessProvider>x</EarlyAccessProvider>);

      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("contatos");
      expect(mockIsFeatureEnabled).toHaveBeenCalledWith("dados");
   });
});

describe("useEarlyAccess", () => {
   it("isEnrolled returns false initially", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});
      const { result } = renderHook(() => useEarlyAccess());
      expect(result.current.isEnrolled("contatos")).toBe(false);
   });

   it("updateEnrollment adds key and calls posthog", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});
      const { result } = renderHook(() => useEarlyAccess());

      act(() => { result.current.updateEnrollment("contatos", true); });

      expect(result.current.isEnrolled("contatos")).toBe(true);
      expect(mockUpdateEarlyAccessFeatureEnrollment).toHaveBeenCalledWith("contatos", true);
   });

   it("updateEnrollment removes key when enrolled=false", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});
      const { result } = renderHook(() => useEarlyAccess());

      act(() => { result.current.updateEnrollment("contatos", true); });
      act(() => { result.current.updateEnrollment("contatos", false); });

      expect(result.current.isEnrolled("contatos")).toBe(false);
      expect(mockUpdateEarlyAccessFeatureEnrollment).toHaveBeenCalledWith("contatos", false);
   });

   it("getFeatureStage returns null when features list is empty", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});
      const { result } = renderHook(() => useEarlyAccess());
      expect(result.current.getFeatureStage("contatos")).toBeNull();
   });

   it("isBannerVisible is false when features list is empty", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});
      const { result } = renderHook(() => useEarlyAccess());
      expect(result.current.isBannerVisible).toBe(false);
   });

   it("dismissBanner sets dismissed flags hiding the banner", () => {
      mockGetEarlyAccessFeatures.mockImplementation(() => {});
      const { result } = renderHook(() => useEarlyAccess());

      act(() => { result.current.dismissBanner(); });

      expect(result.current.isBannerVisible).toBe(false);
   });
});
