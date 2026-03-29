// @vitest-environment jsdom
import { render } from "@testing-library/react";
import posthog from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-js", () => {
   const renderSurvey = vi.fn();
   return { default: { renderSurvey, init: vi.fn() } };
});

vi.mock("@core/posthog/config", () => ({
   POSTHOG_SURVEYS: { bugReport: { id: "survey-123", flagKey: null } },
}));

const mockDismiss = vi.fn();

vi.mock("@/features/feedback/hooks/use-api-error-tracker", () => ({
   useApiErrorTracker: vi.fn(),
}));

import { useApiErrorTracker } from "@/features/feedback/hooks/use-api-error-tracker";
import { AutoBugReporter } from "@/features/feedback/ui/auto-bug-reporter";

beforeEach(() => {
   vi.mocked(posthog.renderSurvey).mockReset();
   mockDismiss.mockReset();
});

describe("AutoBugReporter", () => {
   it("does not call renderSurvey when shouldShowBugReport is false", () => {
      vi.mocked(useApiErrorTracker).mockReturnValue({
         shouldShowBugReport: false,
         dismiss: mockDismiss,
         trackError: vi.fn(),
      });

      render(<AutoBugReporter />);

      expect(posthog.renderSurvey).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
   });

   it("calls renderSurvey and dismiss when shouldShowBugReport is true", () => {
      vi.mocked(useApiErrorTracker).mockReturnValue({
         shouldShowBugReport: true,
         dismiss: mockDismiss,
         trackError: vi.fn(),
      });

      render(<AutoBugReporter />);

      expect(posthog.renderSurvey).toHaveBeenCalledWith("survey-123", "body");
      expect(mockDismiss).toHaveBeenCalled();
   });
});
