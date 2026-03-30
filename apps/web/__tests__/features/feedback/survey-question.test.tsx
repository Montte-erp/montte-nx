// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@packages/ui/components/slider", () => ({
   Slider: ({
      value,
      onValueChange,
      min,
      max,
   }: {
      value: number[];
      onValueChange: (v: number[]) => void;
      min: number;
      max: number;
   }) => (
      <input
         data-testid="slider"
         max={max}
         min={min}
         onChange={(e) => onValueChange([Number(e.target.value)])}
         role="slider"
         type="range"
         value={value[0]}
      />
   ),
}));

import { SurveyQuestion } from "@/features/feedback/ui/survey-question";
import type { SurveyQuestion as SurveyQuestionType } from "@/features/feedback/ui/survey-question";

afterEach(cleanup);

describe("SurveyQuestion", () => {
   const baseQuestion: SurveyQuestionType = {
      id: "q1",
      type: "open",
      question: "What do you think?",
   };

   it("renders question text", () => {
      render(<SurveyQuestion onChange={vi.fn()} question={baseQuestion} value={null} />);
      expect(screen.getByText("What do you think?")).toBeTruthy();
   });

   it("renders optional label when question.optional is true", () => {
      const q = { ...baseQuestion, optional: true };
      render(<SurveyQuestion onChange={vi.fn()} question={q} value={null} />);
      expect(screen.getByText("(opcional)")).toBeTruthy();
   });

   it("renders description when provided", () => {
      const q = { ...baseQuestion, description: "Some extra context" };
      render(<SurveyQuestion onChange={vi.fn()} question={q} value={null} />);
      expect(screen.getByText("Some extra context")).toBeTruthy();
   });

   describe("open type", () => {
      it("renders a textarea", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={baseQuestion} value="hello" />);
         expect(screen.getByPlaceholderText("Escreva aqui...")).toBeTruthy();
      });

      it("calls onChange when textarea changes", () => {
         const onChange = vi.fn();
         render(<SurveyQuestion onChange={onChange} question={baseQuestion} value="" />);
         fireEvent.change(screen.getByPlaceholderText("Escreva aqui..."), {
            target: { value: "new value" },
         });
         expect(onChange).toHaveBeenCalledWith("new value");
      });
   });

   describe("single_choice type", () => {
      const q: SurveyQuestionType = {
         id: "q2",
         type: "single_choice",
         question: "Pick one",
         choices: ["Baixa", "Média", "Alta"],
      };

      it("renders all choices", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value={null} />);
         expect(screen.getByText("Baixa")).toBeTruthy();
         expect(screen.getByText("Média")).toBeTruthy();
         expect(screen.getByText("Alta")).toBeTruthy();
      });

      it("calls onChange when a choice is clicked", () => {
         const onChange = vi.fn();
         render(<SurveyQuestion onChange={onChange} question={q} value={null} />);
         fireEvent.click(screen.getByText("Alta"));
         expect(onChange).toHaveBeenCalledWith("Alta");
      });

      it("applies severity active style to selected choice", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value="Baixa" />);
         const btn = screen.getByText("Baixa");
         expect(btn.className).toContain("bg-emerald-500");
      });
   });

   describe("multiple_choice type", () => {
      const q: SurveyQuestionType = {
         id: "q3",
         type: "multiple_choice",
         question: "Pick many",
         choices: ["Option A", "Option B", "Option C"],
      };

      it("renders checkboxes for each choice", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value={[]} />);
         expect(screen.getByText("Option A")).toBeTruthy();
         expect(screen.getByText("Option B")).toBeTruthy();
      });

      it("calls onChange with added choice when checked", () => {
         const onChange = vi.fn();
         render(<SurveyQuestion onChange={onChange} question={q} value={["Option A"]} />);
         const checkboxB = screen.getByRole("checkbox", { name: /option b/i });
         fireEvent.click(checkboxB);
         expect(onChange).toHaveBeenCalledWith(["Option A", "Option B"]);
      });

      it("calls onChange with removed choice when unchecked", () => {
         const onChange = vi.fn();
         render(<SurveyQuestion onChange={onChange} question={q} value={["Option A", "Option B"]} />);
         const checkboxA = screen.getByRole("checkbox", { name: /option a/i });
         fireEvent.click(checkboxA);
         expect(onChange).toHaveBeenCalledWith(["Option B"]);
      });
   });

   describe("rating type with emoji display", () => {
      const q: SurveyQuestionType = {
         id: "q4",
         type: "rating",
         question: "How do you feel?",
         display: "emoji",
         scale: 5,
         lowerBoundLabel: "Bad",
         upperBoundLabel: "Great",
      };

      it("renders emoji buttons", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value={null} />);
         expect(screen.getByText("😞")).toBeTruthy();
         expect(screen.getByText("😁")).toBeTruthy();
      });

      it("calls onChange with numeric value on click", () => {
         const onChange = vi.fn();
         render(<SurveyQuestion onChange={onChange} question={q} value={null} />);
         fireEvent.click(screen.getByText("😁"));
         expect(onChange).toHaveBeenCalledWith(5);
      });

      it("renders lower and upper bound labels", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value={null} />);
         expect(screen.getByText("Bad")).toBeTruthy();
         expect(screen.getByText("Great")).toBeTruthy();
      });
   });

   describe("rating type with slider (number display)", () => {
      const q: SurveyQuestionType = {
         id: "q5",
         type: "rating",
         question: "Rate 1-10",
         scale: 10,
         lowerBoundLabel: "Low",
         upperBoundLabel: "High",
      };

      it("renders a slider", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value={5} />);
         expect(screen.getByRole("slider")).toBeTruthy();
      });

      it("renders bound labels for slider", () => {
         render(<SurveyQuestion onChange={vi.fn()} question={q} value={null} />);
         expect(screen.getByText("Low")).toBeTruthy();
         expect(screen.getByText("High")).toBeTruthy();
      });
   });
});
