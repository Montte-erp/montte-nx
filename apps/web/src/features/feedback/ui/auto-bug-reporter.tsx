import posthog from "posthog-js";
import { useEffect } from "react";
import { useApiErrorTracker } from "../hooks/use-api-error-tracker";

const BUG_REPORT_SURVEY_ID = "019d3b2e-8eb3-0000-a93d-a90c32f043ef";

export function AutoBugReporter() {
   const { shouldShowBugReport, dismiss } = useApiErrorTracker();

   useEffect(() => {
      if (shouldShowBugReport) {
         posthog.renderSurvey(BUG_REPORT_SURVEY_ID, "body");
         dismiss();
      }
   }, [shouldShowBugReport, dismiss]);

   return null;
}
