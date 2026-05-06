import { Button } from "@packages/ui/components/button";
import { useThumbSurvey } from "posthog-js/react/surveys";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { useClipboard } from "foxact/use-clipboard";
import { POSTHOG_SURVEYS } from "@core/posthog/config";
import { useChatSession } from "./chat-store";

interface MessageFooterProps {
   messageId: string;
   text: string;
}

export function MessageFooter({ messageId, text }: MessageFooterProps) {
   const traceId = useChatSession().traceIdFor(messageId);
   const { copy, copied } = useClipboard({ timeout: 1500 });
   const surveyId = POSTHOG_SURVEYS.aiAgentFeedback.id;
   const surveyReady = traceId !== undefined;

   return (
      <div className="flex items-center gap-1 pt-1">
         <Button
            aria-label="Copiar resposta"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => void copy(text)}
            size="icon"
            variant="ghost"
         >
            {copied ? (
               <Check className="size-4 text-emerald-500" />
            ) : (
               <Copy className="size-4" />
            )}
         </Button>
         {surveyReady ? (
            <FeedbackButtons surveyId={surveyId} traceId={traceId} />
         ) : null}
      </div>
   );
}

function FeedbackButtons({
   surveyId,
   traceId,
}: {
   surveyId: string;
   traceId: string;
}) {
   const { respond, response } = useThumbSurvey({
      surveyId,
      properties: { $ai_trace_id: traceId },
   });
   return (
      <>
         <Button
            aria-label="Resposta útil"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => respond("up")}
            size="icon"
            variant="ghost"
         >
            <ThumbsUp
               className={
                  response === "up" ? "size-4 text-emerald-500" : "size-4"
               }
            />
         </Button>
         <Button
            aria-label="Resposta ruim"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => respond("down")}
            size="icon"
            variant="ghost"
         >
            <ThumbsDown
               className={
                  response === "down" ? "size-4 text-red-500" : "size-4"
               }
            />
         </Button>
      </>
   );
}
