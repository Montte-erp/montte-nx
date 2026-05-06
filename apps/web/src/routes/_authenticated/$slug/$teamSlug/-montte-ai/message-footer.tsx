import { Button } from "@packages/ui/components/button";
import { useThumbSurvey } from "posthog-js/react/surveys";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { useClipboard } from "foxact/use-clipboard";
import { toast } from "sonner";
import { POSTHOG_SURVEYS } from "@core/posthog/config";

interface MessageFooterProps {
   messageId: string;
   text: string;
   traceId?: string;
}

export function MessageFooter({ text, traceId }: MessageFooterProps) {
   const { copy, copied } = useClipboard({ timeout: 1500 });

   const onCopy = async () => {
      await copy(text);
      toast.success("Copiado");
   };

   return (
      <div className="flex items-center gap-1 pt-1">
         <Button
            aria-label="Copiar resposta"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => void onCopy()}
            size="icon"
            variant="ghost"
         >
            {copied ? (
               <Check className="size-4 text-emerald-500" />
            ) : (
               <Copy className="size-4" />
            )}
         </Button>
         <FeedbackButtons traceId={traceId} />
      </div>
   );
}

function FeedbackButtons({ traceId }: { traceId?: string }) {
   const { respond, response } = useThumbSurvey({
      surveyId: POSTHOG_SURVEYS.aiAgentFeedback.id,
      properties: traceId ? { $ai_trace_id: traceId } : {},
   });
   const answered = response === "up" || response === "down";
   const onRespond = (kind: "up" | "down") => {
      if (answered) return;
      respond(kind);
      if (kind === "up") {
         toast.success("Obrigado pelo feedback");
      } else {
         toast("Feedback registrado", { description: "Vamos melhorar." });
      }
   };
   return (
      <>
         <Button
            aria-label="Resposta útil"
            className="size-8 text-muted-foreground hover:text-foreground"
            disabled={answered}
            onClick={() => onRespond("up")}
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
            disabled={answered}
            onClick={() => onRespond("down")}
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
