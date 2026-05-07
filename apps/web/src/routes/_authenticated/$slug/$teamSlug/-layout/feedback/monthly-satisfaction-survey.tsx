import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { useSurveyModal } from "@/hooks/use-survey-modal";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";

export function MonthlySatisfactionSurvey() {
   const { openSurveyModal } = useSurveyModal();
   const triggered = useRef(false);

   useEffect(() => {
      if (triggered.current) return;

      posthog.onSurveysLoaded(() => {
         posthog.getActiveMatchingSurveys((surveys) => {
            const survey = surveys.find(
               (s) => s.id === POSTHOG_SURVEYS.monthlySatisfaction.id,
            );
            if (survey && !triggered.current) {
               triggered.current = true;
               openSurveyModal(POSTHOG_SURVEYS.monthlySatisfaction.id);
            }
         });
      });
   }, [openSurveyModal]);

   return null;
}
