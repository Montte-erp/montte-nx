import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { CheckCircle, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { type FormEvent, useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

type BugReportFormProps = {
   onSuccess: () => void;
};

export function BugReportForm({ onSuccess }: BugReportFormProps) {
   const bugReportSchema = z.object({
      description: z.string().min(1, "Descreva o problema encontrado."),
      severity: z.string(),
   });

   const [isSuccess, setIsSuccess] = useState(false);
   const [isPending, startTransition] = useTransition();

   const form = useForm({
      defaultValues: { description: "", severity: "" },
      onSubmit: async ({ value }) => {
         startTransition(async () => {
            posthog.capture("bug_report_submitted", {
               description: value.description,
               severity: value.severity || undefined,
            });
            toast.success("Obrigado pelo relato! Vamos investigar.");
            setIsSuccess(true);
            setTimeout(onSuccess, 1500);
         });
      },
      validators: { onBlur: bugReportSchema },
   });

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   if (isSuccess) {
      return (
         <DialogStackContent index={0}>
            <div className="flex flex-col items-center gap-4 px-4 py-4 text-center">
               <CheckCircle className="size-10 text-green-500" />
               <p className="text-sm font-medium">Obrigado pelo relato!</p>
               <p className="text-xs text-muted-foreground">
                  Vamos investigar e corrigir o mais rápido possível.
               </p>
            </div>
         </DialogStackContent>
      );
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Reportar Bug</DialogStackTitle>
            <DialogStackDescription>
               Nos ajude a melhorar reportando problemas.
            </DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
               <FieldGroup>
                  <form.Field name="description">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 O que aconteceu?
                              </FieldLabel>
                              <Textarea
                                 aria-invalid={isInvalid}
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Descreva o problema que você encontrou..."
                                 rows={4}
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>

                  <form.Field name="severity">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Qual a gravidade?
                           </FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(value)
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger className="w-full" id={field.name}>
                                 <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="Bloqueante — não consigo usar">
                                    Bloqueante — não consigo usar
                                 </SelectItem>
                                 <SelectItem value="Importante — atrapalha mas consigo contornar">
                                    Importante — atrapalha mas consigo contornar
                                 </SelectItem>
                                 <SelectItem value="Menor — incômodo pequeno">
                                    Menor — incômodo pequeno
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <form.Subscribe selector={(state) => state}>
                  {(canSubmit) => (
                     <Button
                        className="w-full"
                        disabled={!canSubmit || isPending}
                        type="submit"
                     >
                        {isPending && (
                           <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Enviar relato
                     </Button>
                  )}
               </form.Subscribe>
            </form>
         </div>
      </DialogStackContent>
   );
}
