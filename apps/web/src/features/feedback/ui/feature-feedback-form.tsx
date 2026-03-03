import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Label } from "@packages/ui/components/label";
import { Rating, RatingButton } from "@packages/ui/components/rating";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

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

   const mutation = useMutation(
      orpc.feedback.submitFeatureFeedback.mutationOptions({
         onSuccess: () => {
            toast.success("Obrigado pelo feedback!");
            setTimeout(onSuccess, 1500);
         },
         onError: (error) => {
            toast.error(error.message ?? "Erro ao enviar feedback.");
         },
      }),
   );

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (rating === 0) return;

      await mutation.mutateAsync({
         rating,
         improvement: improvement || undefined,
         featureName,
      });
   };

   if (mutation.isSuccess) {
      return (
         <CredenzaBody className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="size-8 text-green-500" />
            <p className="text-sm font-medium">Obrigado pelo feedback!</p>
            <p className="text-xs text-muted-foreground">
               Seu retorno nos ajuda a melhorar essa funcionalidade.
            </p>
         </CredenzaBody>
      );
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Feedback: {featureName}</CredenzaTitle>
            <CredenzaDescription>
               Nos conte o que achou dessa funcionalidade.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <form className="space-y-4" onSubmit={handleSubmit}>
               <div className="space-y-2">
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

               <div className="space-y-2">
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
                  disabled={rating === 0 || mutation.isPending}
                  size="lg"
                  type="submit"
               >
                  {mutation.isPending && (
                     <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Enviar feedback
               </Button>
            </form>
         </CredenzaBody>
      </>
   );
}
