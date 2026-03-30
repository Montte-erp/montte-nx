// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSurveys, mockCapture } = vi.hoisted(() => ({
   mockGetSurveys: vi.fn(),
   mockCapture: vi.fn(),
}));

vi.mock("posthog-js", () => ({
   default: {
      getSurveys: mockGetSurveys,
      capture: mockCapture,
   },
}));

vi.mock("@packages/ui/components/dialog", () => ({
   DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
   DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
   DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
   DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@packages/ui/components/spinner", () => ({
   Spinner: ({ className }: { className?: string }) => <div className={className} data-testid="spinner" />,
}));

vi.mock("./survey-question", () => ({
   SurveyQuestion: ({ question }: { question: { question: string } }) => (
      <div data-testid="survey-question">{question.question}</div>
   ),
}));

import React from "react";
import { SurveyModalContent } from "@/features/feedback/ui/survey-modal-content";

const fakeSurvey = {
   id: "survey-abc",
   name: "Bug Report",
   questions: [
      { id: "q1", type: "open" as const, question: "Describe the bug" },
   ],
};

afterEach(cleanup);

beforeEach(() => {
   mockGetSurveys.mockReset();
   mockCapture.mockReset();
});

describe("SurveyModalContent", () => {
   it("shows spinner while survey is loading", () => {
      mockGetSurveys.mockImplementation(() => {});
      render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />);
      expect(screen.getByTestId("spinner")).toBeTruthy();
   });

   it("calls posthog.capture survey shown when survey is found", async () => {
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      await act(async () => {
         render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />);
      });
      expect(mockCapture).toHaveBeenCalledWith("survey shown", { $survey_id: "survey-abc" });
   });

   it("renders survey title from SURVEY_META when survey is found", async () => {
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      await act(async () => {
         render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />);
      });
      expect(screen.getByText("Reportar um problema")).toBeTruthy();
   });

   it("uses custom title and description when provided", async () => {
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      await act(async () => {
         render(
            <SurveyModalContent
               description="Custom desc"
               onClose={vi.fn()}
               surveyId="survey-abc"
               title="Custom Title"
            />,
         );
      });
      expect(screen.getByText("Custom Title")).toBeTruthy();
      expect(screen.getByText("Custom desc")).toBeTruthy();
   });

   it("falls back to survey name as title when name not in SURVEY_META", async () => {
      const unknownSurvey = { ...fakeSurvey, name: "Unknown Survey Type" };
      mockGetSurveys.mockImplementation((cb: (s: typeof unknownSurvey[]) => void) => cb([unknownSurvey]));
      await act(async () => {
         render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />);
      });
      expect(screen.getByText("Unknown Survey Type")).toBeTruthy();
   });

   it("calls onClose when survey is not found", async () => {
      const onClose = vi.fn();
      mockGetSurveys.mockImplementation((cb: (s: never[]) => void) => cb([]));
      await act(async () => {
         render(<SurveyModalContent onClose={onClose} surveyId="survey-abc" />);
      });
      expect(onClose).toHaveBeenCalled();
   });

   it("renders question and action buttons", async () => {
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      await act(async () => {
         render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />);
      });
      expect(screen.getByText("Describe the bug")).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
      expect(screen.getByText("Enviar")).toBeTruthy();
   });

   it("Enviar button is disabled when required question is empty", async () => {
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      await act(async () => {
         render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />);
      });
      expect((screen.getByText("Enviar") as HTMLButtonElement).disabled).toBe(true);
   });

   it("calls onClose when Cancelar is clicked", async () => {
      const onClose = vi.fn();
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      await act(async () => {
         render(<SurveyModalContent onClose={onClose} surveyId="survey-abc" />);
      });
      fireEvent.click(screen.getByText("Cancelar"));
      expect(onClose).toHaveBeenCalled();
   });

   it("submits survey and calls onClose when optional question is sent", async () => {
      const onClose = vi.fn();
      const surveyWithOptional = {
         ...fakeSurvey,
         questions: [{ id: "q1", type: "open" as const, question: "Describe the bug", optional: true }],
      };
      mockGetSurveys.mockImplementation((cb: (s: typeof surveyWithOptional[]) => void) => cb([surveyWithOptional]));
      await act(async () => {
         render(<SurveyModalContent onClose={onClose} surveyId="survey-abc" />);
      });
      fireEvent.click(screen.getByText("Enviar"));
      expect(mockCapture).toHaveBeenCalledWith("survey sent", expect.objectContaining({ $survey_id: "survey-abc" }));
      expect(onClose).toHaveBeenCalled();
   });

   it("captures survey dismissed on unmount if survey was shown but not submitted", async () => {
      mockGetSurveys.mockImplementation((cb: (s: typeof fakeSurvey[]) => void) => cb([fakeSurvey]));
      let unmount!: () => void;
      await act(async () => {
         ({ unmount } = render(<SurveyModalContent onClose={vi.fn()} surveyId="survey-abc" />));
      });
      mockCapture.mockClear();
      act(() => { unmount(); });
      expect(mockCapture).toHaveBeenCalledWith("survey dismissed", { $survey_id: "survey-abc" });
   });
});
