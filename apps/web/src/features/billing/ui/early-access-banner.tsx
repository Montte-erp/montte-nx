import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   type FeatureStage,
   STAGE_CONFIG,
} from "@packages/ui/components/feature-stage-badge";
import { cn } from "@packages/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { FlaskConical } from "lucide-react";
import { useSurveyModal } from "@/hooks/use-survey-modal";

const STAGE_ICON_COLOR: Record<FeatureStage, string> = {
   alpha: "text-chart-1",
   beta: "text-chart-2",
   concept: "text-chart-3",
   "general-availability": "text-chart-4",
};

export type EarlyAccessBannerTemplate = {
   badgeLabel: string;
   message: string;
   ctaLabel: string;
   bullets: string[];
   stage: FeatureStage;
   icon?: LucideIcon;
   surveyId?: string;
   surveyTitle?: string;
   surveyDescription?: string;
};

export type EarlyAccessBannerProps = {
   template: EarlyAccessBannerTemplate;
};

export function EarlyAccessBanner({ template }: EarlyAccessBannerProps) {
   const { openSurveyModal } = useSurveyModal();
   const Icon = template.icon ?? FlaskConical;
   const stage = template.stage ?? "beta";
   const iconColor = STAGE_ICON_COLOR[stage];
   const badgeClassName = STAGE_CONFIG[stage].className;

   return (
      <div className="rounded-lg border bg-card p-4 flex gap-4">
         <div className="shrink-0 pt-0.5">
            <Icon className={cn("size-5", iconColor)} />
         </div>
         <div className="space-y-3">
            <div className="flex items-center gap-2">
               <Badge className={badgeClassName} variant="outline">
                  {template.badgeLabel}
               </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
               {template.message}{" "}
               {template.surveyId && (
                  <Button
                     className="h-auto p-0 text-foreground underline underline-offset-4 hover:text-primary"
                     onClick={() =>
                        openSurveyModal(template.surveyId!, {
                           title: template.surveyTitle,
                           description: template.surveyDescription,
                        })
                     }
                     type="button"
                     variant="link"
                  >
                     {template.ctaLabel}
                  </Button>
               )}
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
               {template.bullets.map((bullet, index) => (
                  <li key={`early-access-bullet-${index + 1}`}>{bullet}</li>
               ))}
            </ul>
         </div>
      </div>
   );
}
