import type { FormEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useLocalStorage } from "foxact/use-local-storage";
import { motion, AnimatePresence } from "motion/react";
import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import { Field, FieldError } from "@packages/ui/components/field";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { ArrowRight, Check } from "lucide-react";
import { z } from "zod";

const STORAGE_KEY = "montte:waitlist:email";

const waitlistSchema = z.object({
   email: z.email("Informe um e-mail válido."),
});

const waitlistResponseSchema = z.object({
   ok: z.boolean(),
   message: z.string().optional(),
   email: z.string().optional(),
});

export function WaitlistForm() {
   const [storedEmail, setStoredEmail] = useLocalStorage<string | null>(
      STORAGE_KEY,
      null,
   );

   const form = useForm({
      defaultValues: { email: "" },
      validators: { onSubmit: waitlistSchema },
      onSubmit: async ({ value }: { value: { email: string } }) => {
         const email = value.email.trim().toLowerCase();

         try {
            const response = await fetch("/api/waitlist", {
               method: "POST",
               headers: {
                  "content-type": "application/json",
               },
               body: JSON.stringify({ email }),
            });

            const parsedPayload: unknown = await response.json();
            const parseResult = waitlistResponseSchema.safeParse(parsedPayload);
            if (!parseResult.success) {
               form.setFieldMeta("email", (previous) => ({
                  ...previous,
                  errors: ["Não foi possível registrar seu e-mail."],
               }));
               return;
            }

            const payload = parseResult.data;
            if (!response.ok || payload.ok === false) {
               form.setFieldMeta("email", (previous) => ({
                  ...previous,
                  errors: [
                     payload.message ??
                        "Não foi possível registrar seu e-mail.",
                  ],
               }));
               return;
            }

            form.setFieldMeta("email", (previous) => ({
               ...previous,
               errors: [],
            }));

            setStoredEmail(payload.email ?? email);
         } catch {
            form.setFieldMeta("email", (previous) => ({
               ...previous,
               errors: [
                  "Não foi possível registrar seu e-mail. Tente novamente.",
               ],
            }));
         }
      },
   });

   const alreadyJoined = storedEmail !== null;

   return (
      <div className="flex w-full flex-col gap-8">
         <AnimatePresence mode="wait" initial={false}>
            {alreadyJoined ? (
               <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
               >
                  <Alert
                     aria-live="polite"
                     className="rounded-2xl border-border/40 bg-background/80 text-left shadow-2xl shadow-background/40 backdrop-blur-xl [&>svg]:text-primary"
                  >
                     <Check strokeWidth={2.25} aria-hidden="true" />
                     <AlertTitle className="font-sans">
                        Lugar reservado
                     </AlertTitle>
                     <AlertDescription>
                        <p>
                           Avisamos{" "}
                           <span className="font-semibold text-foreground">
                              {storedEmail}
                           </span>{" "}
                           assim que o próximo lote abrir. Sem spam, só o
                           convite.
                        </p>
                     </AlertDescription>
                  </Alert>
               </motion.div>
            ) : (
               <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  onSubmit={(event) => {
                     event.preventDefault();
                     event.stopPropagation();
                     form.handleSubmit();
                  }}
                  noValidate
               >
                  <form.Field
                     name="email"
                     children={(field) => {
                        const errors = field.state.meta.errors;
                        const isInvalid = errors.length > 0;
                        return (
                           <Field>
                              <InputGroup size="lg">
                                 <InputGroupInput
                                    id={field.name}
                                    name={field.name}
                                    type="email"
                                    placeholder="seu@email.com.br"
                                    aria-label="Seu e-mail"
                                    aria-invalid={isInvalid}
                                    disabled={form.state.isSubmitting}
                                    value={field.state.value}
                                    onInput={(e: FormEvent<HTMLInputElement>) =>
                                       field.handleChange(e.currentTarget.value)
                                    }
                                    onBlur={() => field.handleBlur()}
                                    required
                                 />
                                 <InputGroupAddon align="inline-end">
                                    <Button
                                       type="submit"
                                       disabled={form.state.isSubmitting}
                                       data-ph-cta="waitlist_submit"
                                    >
                                       {form.state.isSubmitting
                                          ? "Enviando…"
                                          : "Entrar na lista"}
                                       {!form.state.isSubmitting ? (
                                          <ArrowRight aria-hidden="true" />
                                       ) : null}
                                    </Button>
                                 </InputGroupAddon>
                              </InputGroup>
                              <FieldError errors={errors} />
                           </Field>
                        );
                     }}
                  />
               </motion.form>
            )}
         </AnimatePresence>
      </div>
   );
}
