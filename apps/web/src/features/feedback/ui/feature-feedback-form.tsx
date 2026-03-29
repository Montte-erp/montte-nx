import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import { Label } from "@packages/ui/components/label";
import { Rating, RatingButton } from "@packages/ui/components/rating";
import { Textarea } from "@packages/ui/components/textarea";
import { CheckCircle, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type FeatureFeedbackFormProps = {
   featureName: string;
   onSuccess: () => void;
};

export function FeatureFeedbackForm({
   featureName,
   onSuccess,
}: FeatureFeedbackFormProps) {
   const [rating, setRating] = useState(0);
   const [improvement, setImprovement] = useState("");
   const [isSuccess, setIsSuccess] = useState(false);
   const [isPending, startTransition] = useTransition();

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (rating === 0) return;

      startTransition(async () => {
         posthog.capture("feature_feedback_submitted", {
            rating,
            improvement: improvement || undefined,
            featureName,
         });
         toast.success("Obrigado pelo feedback!");
         setIsSuccess(true);
         setTimeout(onSuccess, 1500);
      });
   };

   if (isSuccess) {
      return (
         <DialogStackContent index={0}>
            <div className="flex flex-col items-center gap-4 px-4 py-4 text-center">
               <CheckCircle className="size-8 text-green-500" />
               <p className="text-sm font-medium">Obrigado pelo feedback!</p>
               <p className="text-xs text-muted-foreground">
                  Seu retorno nos ajuda a melhorar essa funcionalidade.
               </p>
            </div>
         </DialogStackContent>
      );
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Feedback: {featureName}</DialogStackTitle>
            <DialogStackDescription>
               Nos conte o que achou dessa funcionalidade.
            </DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
               <div className="flex flex-col gap-2">
                  <Label>Como está sendo a experiência?</Label>
                  <Rating onValueChange={setRating} value={rating}>
                     <RatingButton />
                     <RatingButton />
                     <RatingButton />
                     <RatingButton />
                     <RatingButton />
                  </Rating>
                  <div className="flex justify-between text-xs text-muted-foreground">
                     <span>Péssima</span>
                     <span>Excelente</span>
                  </div>
               </div>

               <div className="flex flex-col gap-2">
                  <Label htmlFor="feature-improvement">
                     O que poderia melhorar?{" "}
                     <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Textarea
                     id="feature-improvement"
                     onChange={(e) => setImprovement(e.target.value)}
                     placeholder="Conte o que falta ou o que te incomoda..."
                     rows={3}
                     value={improvement}
                  />
               </div>

               <Button
                  className="w-full"
                  disabled={rating === 0 || isPending}
                  size="lg"
                  type="submit"
               >
                  {isPending && (
                     <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Enviar feedback
               </Button>
            </form>
         </div>
      </DialogStackContent>
   );
}
