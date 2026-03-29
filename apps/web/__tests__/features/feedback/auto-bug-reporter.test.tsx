// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockRenderSurvey, mockDismiss } = vi.hoisted(() => ({
   mockRenderSurvey: vi.fn(),
   mockDismiss: vi.fn(),
}));

vi.mock("posthog-js", () => ({
   default: { renderSurvey: mockRenderSurvey },
}));

vi.mock("@core/posthog/config", () => ({
   POSTHOG_SURVEYS: { bugReport: { id: "survey-123", flagKey: null } },
}));

vi.mock("@/features/feedback/hooks/use-api-error-tracker", () => ({
   useApiErrorTracker: vi.fn(),
}));

import { useApiErrorTracker } from "@/features/feedback/hooks/use-api-error-tracker";
import { AutoBugReporter } from "@/features/feedback/ui/auto-bug-reporter";

describe("AutoBugReporter", () => {
   it("does not call renderSurvey when shouldShowBugReport is false", () => {
      vi.mocked(useApiErrorTracker).mockReturnValue({
         shouldShowBugReport: false,
         dismiss: mockDismiss,
         trackError: vi.fn(),
      });

      render(<AutoBugReporter />);

      expect(mockRenderSurvey).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
   });

   it("calls renderSurvey and dismiss when shouldShowBugReport is true", () => {
      vi.mocked(useApiErrorTracker).mockReturnValue({
         shouldShowBugReport: true,
         dismiss: mockDismiss,
         trackError: vi.fn(),
      });

      render(<AutoBugReporter />);

      expect(mockRenderSurvey).toHaveBeenCalledWith("survey-123", "body");
      expect(mockDismiss).toHaveBeenCalled();
   });
});
