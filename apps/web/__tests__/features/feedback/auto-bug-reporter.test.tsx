// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockOpenSurveyModal = vi.fn();
const mockDismiss = vi.fn();

vi.mock("@core/posthog/config", () => ({
   POSTHOG_SURVEYS: { bugReport: { id: "survey-123", flagKey: null } },
}));

vi.mock("@/hooks/use-survey-modal", () => ({
   useSurveyModal: () => ({ openSurveyModal: mockOpenSurveyModal }),
}));

vi.mock("@/features/feedback/hooks/use-api-error-tracker", () => ({
   useApiErrorTracker: vi.fn(),
}));

import { useApiErrorTracker } from "@/features/feedback/hooks/use-api-error-tracker";
import { AutoBugReporter } from "@/features/feedback/ui/auto-bug-reporter";

describe("AutoBugReporter", () => {
   it("does not call openSurveyModal when shouldShowBugReport is false", async () => {
      vi.mocked(useApiErrorTracker).mockReturnValue({
         shouldShowBugReport: false,
         dismiss: mockDismiss,
         reset: vi.fn(),
      });

      await act(async () => { render(<AutoBugReporter />); });

      expect(mockOpenSurveyModal).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
   });

   it("calls openSurveyModal with survey id and dismiss when shouldShowBugReport is true", async () => {
      vi.mocked(useApiErrorTracker).mockReturnValue({
         shouldShowBugReport: true,
         dismiss: mockDismiss,
         reset: vi.fn(),
      });

      await act(async () => { render(<AutoBugReporter />); });

      expect(mockOpenSurveyModal).toHaveBeenCalledWith("survey-123");
      expect(mockDismiss).toHaveBeenCalled();
   });
});
