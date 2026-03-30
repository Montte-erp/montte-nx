import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { useSurveyModal } from "@/hooks/use-survey-modal";
import { useEffect } from "react";
import { useApiErrorTracker } from "../hooks/use-api-error-tracker";

export function AutoBugReporter() {
   const { shouldShowBugReport, dismiss } = useApiErrorTracker();
   const { openSurveyModal } = useSurveyModal();

   useEffect(() => {
      if (shouldShowBugReport) {
         openSurveyModal(POSTHOG_SURVEYS.bugReport.id);
         dismiss();
      }
   }, [shouldShowBugReport, dismiss, openSurveyModal]);

   return null;
}
