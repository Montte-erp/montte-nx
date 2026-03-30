// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@packages/ui/components/dialog", () => ({
   Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="dialog">{children}</div> : null,
   DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/feedback/ui/survey-modal-content", () => ({
   SurveyModalContent: ({ surveyId }: { surveyId: string }) => (
      <div data-testid="survey-modal-content">{surveyId}</div>
   ),
}));

import React from "react";
import { GlobalSurveyModal, useSurveyModal } from "@/hooks/use-survey-modal";

afterEach(() => {
   const { closeSurveyModal } = renderHook(() => useSurveyModal()).result.current;
   act(() => { closeSurveyModal(); });
   cleanup();
});

describe("useSurveyModal", () => {
   it("openSurveyModal opens the modal with the given surveyId", () => {
      const { result } = renderHook(() => useSurveyModal());
      act(() => { result.current.openSurveyModal("survey-123"); });
      render(<GlobalSurveyModal />);
      expect(screen.getByTestId("dialog")).toBeTruthy();
      expect(screen.getByTestId("survey-modal-content").textContent).toBe("survey-123");
   });

   it("closeSurveyModal closes the modal", () => {
      const { result } = renderHook(() => useSurveyModal());
      act(() => { result.current.openSurveyModal("survey-123"); });
      act(() => { result.current.closeSurveyModal(); });
      render(<GlobalSurveyModal />);
      expect(screen.queryByTestId("dialog")).toBeNull();
   });

   it("openSurveyModal accepts optional title and description", () => {
      const { result } = renderHook(() => useSurveyModal());
      act(() => {
         result.current.openSurveyModal("survey-456", { title: "My Title", description: "My Desc" });
      });
      render(<GlobalSurveyModal />);
      expect(screen.getByTestId("survey-modal-content").textContent).toBe("survey-456");
   });
});

describe("GlobalSurveyModal", () => {
   it("renders nothing when modal is closed", () => {
      render(<GlobalSurveyModal />);
      expect(screen.queryByTestId("dialog")).toBeNull();
   });

   it("does not render SurveyModalContent when surveyId is null", () => {
      render(<GlobalSurveyModal />);
      expect(screen.queryByTestId("survey-modal-content")).toBeNull();
   });
});
