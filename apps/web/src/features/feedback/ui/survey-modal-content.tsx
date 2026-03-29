import { Button } from "@packages/ui/components/button";
import {
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@packages/ui/components/dialog";
import { Spinner } from "@packages/ui/components/spinner";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { SurveyQuestion } from "./survey-question";
import type { SurveyQuestion as SurveyQuestionType } from "./survey-question";

type PostHogSurvey = {
   id: string;
   name: string;
   questions: SurveyQuestionType[];
};

const SURVEY_META: Record<string, { title: string; description: string }> = {
   "Bug Report": {
      title: "Reportar um problema",
      description: "Descreva o que aconteceu para que possamos corrigir o mais rápido possível.",
   },
   "Feature Request": {
      title: "Sugestão de funcionalidade",
      description: "Compartilhe sua ideia. Toda sugestão é analisada pela nossa equipe.",
   },
   "Feature Feedback": {
      title: "Avalie esta funcionalidade",
      description: "Sua opinião nos ajuda a melhorar continuamente o produto.",
   },
   "Sugestão de Integração": {
      title: "Sugerir integração",
      description: "Conte-nos quais ferramentas você usa e qual integração faria mais diferença na sua operação.",
   },
};

type Responses = Record<string, string | string[] | number | null>;

type SurveyModalContentProps = {
   surveyId: string;
   onClose: () => void;
   title?: string;
   description?: string;
};

export function SurveyModalContent({ surveyId, onClose, title, description }: SurveyModalContentProps) {
   const [survey, setSurvey] = useState<PostHogSurvey | null>(null);
   const [responses, setResponses] = useState<Responses>({});
   const [submitted, setSubmitted] = useState(false);

   useEffect(() => {
      posthog.getSurveys((surveys) => {
         const found = surveys.find((s) => s.id === surveyId) as PostHogSurvey | undefined;
         if (found) {
            setSurvey(found);
            posthog.capture("survey shown", { $survey_id: surveyId });
         }
      });

      return () => {
         if (!submitted) {
            posthog.capture("survey dismissed", { $survey_id: surveyId });
         }
      };
   }, [surveyId, submitted]);

   const handleChange = (questionId: string, value: string | string[] | number) => {
      setResponses((prev) => ({ ...prev, [questionId]: value }));
   };

   const handleSubmit = () => {
      if (!survey) return;

      const responsePayload: Record<string, unknown> = { $survey_id: survey.id };
      for (const question of survey.questions) {
         const val = responses[question.id];
         if (val !== undefined && val !== null && val !== "") {
            responsePayload[`$survey_response_${question.id}`] =
               typeof val === "number" ? String(val) : val;
         }
      }

      posthog.capture("survey sent", responsePayload);
      setSubmitted(true);
      onClose();
   };

   const canSubmit = survey?.questions
      .filter((q) => !q.optional)
      .every((q) => {
         const val = responses[q.id];
         if (Array.isArray(val)) return val.length > 0;
         return val !== undefined && val !== null && val !== "";
      });

   if (!survey) {
      return (
         <div className="flex items-center justify-center py-8">
            <Spinner className="size-5 animate-spin text-muted-foreground" />
         </div>
      );
   }

   const defaultMeta = SURVEY_META[survey.name] ?? {
      title: survey.name,
      description: "Preencha as informações abaixo e envie sua resposta.",
   };
   const meta = {
      title: title ?? defaultMeta.title,
      description: description ?? defaultMeta.description,
   };

   return (
      <>
         <DialogHeader>
            <DialogTitle>{meta.title}</DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
         </DialogHeader>
         <div className="flex flex-col gap-4">
            {survey.questions.map((question) => (
               <SurveyQuestion
                  key={question.id}
                  onChange={(val) => handleChange(question.id, val)}
                  question={question}
                  value={responses[question.id] ?? null}
               />
            ))}
         </div>
         <DialogFooter>
            <Button onClick={onClose} variant="ghost">
               Cancelar
            </Button>
            <Button disabled={!canSubmit} onClick={handleSubmit}>
               Enviar
            </Button>
         </DialogFooter>
      </>
   );
}
