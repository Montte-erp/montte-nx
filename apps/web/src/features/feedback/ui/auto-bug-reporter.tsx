import { POSTHOG_SURVEYS } from "@core/posthog/config";
import posthog from "posthog-js";
import { useEffect } from "react";
import { useApiErrorTracker } from "../hooks/use-api-error-tracker";

export function AutoBugReporter() {
   const { shouldShowBugReport, dismiss } = useApiErrorTracker();

   useEffect(() => {
      if (shouldShowBugReport) {
         posthog.renderSurvey(POSTHOG_SURVEYS.bugReport.id, "body");
         dismiss();
      }
   }, [shouldShowBugReport, dismiss]);

   return null;
}
