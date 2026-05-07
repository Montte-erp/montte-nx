import { useEffect } from "react";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Label } from "@packages/ui/components/label";
import { Slider } from "@packages/ui/components/slider";
import { Textarea } from "@packages/ui/components/textarea";
import { cn } from "@packages/ui/lib/utils";

const EMOJI_SCALE = ["😞", "😕", "😐", "🙂", "😁"];

const SEVERITY_COLORS: Record<string, { idle: string; active: string }> = {
   Baixa: {
      idle: "border-emerald-500/30 text-emerald-600",
      active: "bg-emerald-500 text-white border-emerald-500",
   },
   Média: {
      idle: "border-yellow-500/30 text-yellow-600",
      active: "bg-yellow-500 text-white border-yellow-500",
   },
   Alta: {
      idle: "border-orange-500/30 text-orange-600",
      active: "bg-orange-500 text-white border-orange-500",
   },
   Crítica: {
      idle: "border-red-500/30 text-red-600",
      active: "bg-red-500 text-white border-red-500",
   },
};

const CHOICE_COLORS = [
   {
      idle: "border-border",
      active: "bg-primary text-primary-foreground border-primary",
   },
];

export type SurveyQuestion = {
   id: string;
   type: "open" | "single_choice" | "multiple_choice" | "rating";
   question: string;
   description?: string;
   optional?: boolean;
   choices?: string[];
   scale?: number;
   display?: "number" | "emoji";
   lowerBoundLabel?: string;
   upperBoundLabel?: string;
};

type SurveyQuestionProps = {
   question: SurveyQuestion;
   value: string | string[] | number | null;
   onChange: (value: string | string[] | number) => void;
};

export function SurveyQuestion({
   question,
   value,
   onChange,
}: SurveyQuestionProps) {
   useEffect(() => {
      if (
         question.type === "rating" &&
         question.display !== "emoji" &&
         value === null
      ) {
         onChange(1);
      }
   }, []);

   return (
      <div className="flex flex-col gap-2">
         <Label className="text-sm font-medium leading-snug">
            {question.question}
            {question.optional && (
               <span className="ml-1 text-muted-foreground font-normal">
                  (opcional)
               </span>
            )}
         </Label>
         {question.description && (
            <p className="text-xs text-muted-foreground">
               {question.description}
            </p>
         )}
         {question.type === "open" && (
            <Textarea
               onChange={(e) => onChange(e.target.value)}
               placeholder="Escreva aqui..."
               rows={3}
               value={(value as string) ?? ""}
            />
         )}
         {question.type === "single_choice" && question.choices && (
            <div className="flex flex-wrap gap-2">
               {question.choices.map((choice, i) => {
                  const isSelected = value === choice;
                  const severityColor =
                     SEVERITY_COLORS[choice] ??
                     CHOICE_COLORS[i % CHOICE_COLORS.length];
                  return (
                     <button
                        className={cn(
                           "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                           isSelected
                              ? severityColor.active
                              : cn(
                                   "hover:bg-accent hover:text-accent-foreground",
                                   severityColor.idle,
                                ),
                        )}
                        key={choice}
                        onClick={() => onChange(choice)}
                        type="button"
                     >
                        {choice}
                     </button>
                  );
               })}
            </div>
         )}
         {question.type === "multiple_choice" && question.choices && (
            <div className="flex flex-col gap-2">
               {question.choices.map((choice) => {
                  const selected =
                     Array.isArray(value) && value.includes(choice);
                  return (
                     <div className="flex items-center gap-2" key={choice}>
                        <Checkbox
                           checked={selected}
                           id={`${question.id}-${choice}`}
                           onCheckedChange={(checked) => {
                              const current = Array.isArray(value) ? value : [];
                              onChange(
                                 checked
                                    ? [...current, choice]
                                    : current.filter((v) => v !== choice),
                              );
                           }}
                        />
                        <Label
                           className="font-normal cursor-pointer"
                           htmlFor={`${question.id}-${choice}`}
                        >
                           {choice}
                        </Label>
                     </div>
                  );
               })}
            </div>
         )}
         {question.type === "rating" && question.display === "emoji" && (
            <div className="flex flex-col gap-2">
               <div className="flex gap-2">
                  {Array.from({ length: question.scale ?? 5 }, (_, i) => {
                     const ratingValue = i + 1;
                     const isSelected = value === ratingValue;
                     return (
                        <button
                           className={cn(
                              "flex-1 rounded-md border py-2 text-lg transition-colors",
                              isSelected
                                 ? "bg-primary text-primary-foreground border-primary"
                                 : "hover:bg-accent hover:text-accent-foreground",
                           )}
                           key={ratingValue}
                           onClick={() => onChange(ratingValue)}
                           type="button"
                        >
                           {EMOJI_SCALE[i]}
                        </button>
                     );
                  })}
               </div>
               {(question.lowerBoundLabel || question.upperBoundLabel) && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                     <span>{question.lowerBoundLabel}</span>
                     <span>{question.upperBoundLabel}</span>
                  </div>
               )}
            </div>
         )}
         {question.type === "rating" && question.display !== "emoji" && (
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-4">
                  <Slider
                     max={question.scale ?? 5}
                     min={1}
                     onValueChange={([v]) => onChange(v)}
                     step={1}
                     value={value !== null ? [value as number] : [1]}
                  />
                  <span className="w-6 text-center text-sm font-medium tabular-nums">
                     {value ?? 1}
                  </span>
               </div>
               {(question.lowerBoundLabel || question.upperBoundLabel) && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                     <span>{question.lowerBoundLabel}</span>
                     <span>{question.upperBoundLabel}</span>
                  </div>
               )}
            </div>
         )}
      </div>
   );
}
