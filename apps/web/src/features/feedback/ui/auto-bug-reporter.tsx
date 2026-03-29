import { POSTHOG_SURVEYS } from "@core/posthog/config";
import posthog, { DisplaySurveyType } from "posthog-js";
import { useEffect } from "react";
import { useApiErrorTracker } from "../hooks/use-api-error-tracker";

export function AutoBugReporter() {
   const { shouldShowBugReport, dismiss } = useApiErrorTracker();

   useEffect(() => {
      if (shouldShowBugReport) {
         posthog.onSurveysLoaded(() => {
            posthog.displaySurvey(POSTHOG_SURVEYS.bugReport.id, {
               displayType: DisplaySurveyType.Popover,
               ignoreConditions: true,
               ignoreDelay: true,
            });
         });
         dismiss();
      }
   }, [shouldShowBugReport, dismiss]);

   return null;
}
