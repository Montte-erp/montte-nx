// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockOpenSurveyModal, mockOnSurveysLoaded, mockGetActiveMatchingSurveys } = vi.hoisted(() => ({
   mockOpenSurveyModal: vi.fn(),
   mockOnSurveysLoaded: vi.fn(),
   mockGetActiveMatchingSurveys: vi.fn(),
}));

vi.mock("@core/posthog/config", () => ({
   POSTHOG_SURVEYS: { monthlySatisfaction: { id: "monthly-survey-id" } },
}));

vi.mock("@/hooks/use-survey-modal", () => ({
   useSurveyModal: () => ({ openSurveyModal: mockOpenSurveyModal }),
}));

vi.mock("posthog-js", () => ({
   default: {
      onSurveysLoaded: mockOnSurveysLoaded,
      getActiveMatchingSurveys: mockGetActiveMatchingSurveys,
   },
}));

import { MonthlySatisfactionSurvey } from "@/features/feedback/ui/monthly-satisfaction-survey";

beforeEach(() => {
   mockOpenSurveyModal.mockReset();
   mockOnSurveysLoaded.mockReset();
   mockGetActiveMatchingSurveys.mockReset();
});

describe("MonthlySatisfactionSurvey", () => {
   it("renders null", () => {
      mockOnSurveysLoaded.mockImplementation(() => {});
      const { container } = render(<MonthlySatisfactionSurvey />);
      expect(container.firstChild).toBeNull();
   });

   it("calls openSurveyModal when survey is active", async () => {
      mockOnSurveysLoaded.mockImplementation((cb: () => void) => cb());
      mockGetActiveMatchingSurveys.mockImplementation(
         (cb: (surveys: { id: string }[]) => void) =>
            cb([{ id: "monthly-survey-id" }]),
      );

      await act(async () => { render(<MonthlySatisfactionSurvey />); });

      expect(mockOpenSurveyModal).toHaveBeenCalledWith("monthly-survey-id");
   });

   it("does not call openSurveyModal when survey is not in active list", async () => {
      mockOnSurveysLoaded.mockImplementation((cb: () => void) => cb());
      mockGetActiveMatchingSurveys.mockImplementation(
         (cb: (surveys: { id: string }[]) => void) => cb([{ id: "other-survey" }]),
      );

      await act(async () => { render(<MonthlySatisfactionSurvey />); });

      expect(mockOpenSurveyModal).not.toHaveBeenCalled();
   });

   it("does not trigger survey twice on re-render", async () => {
      mockOnSurveysLoaded.mockImplementation((cb: () => void) => cb());
      mockGetActiveMatchingSurveys.mockImplementation(
         (cb: (surveys: { id: string }[]) => void) =>
            cb([{ id: "monthly-survey-id" }]),
      );

      let rerender!: (ui: React.ReactElement) => void;
      await act(async () => {
         ({ rerender } = render(<MonthlySatisfactionSurvey />));
      });
      await act(async () => { rerender(<MonthlySatisfactionSurvey />); });

      expect(mockOpenSurveyModal).toHaveBeenCalledTimes(1);
   });
});
