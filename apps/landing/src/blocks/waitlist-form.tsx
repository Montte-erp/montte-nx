import type { FormEvent } from "react";
import { useForm } from "@tanstack/react-form";
import { useLocalStorage } from "foxact/use-local-storage";
import { motion, AnimatePresence } from "motion/react";
import { fromPromise } from "neverthrow";
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
   email: z.email("E-mail inválido."),
});

const errorMessages: Record<string, string> = {
   rate_limited: "Muitas tentativas. Espera um pouco.",
   email_rejected: "E-mail descartável ou inválido — usa um e-mail real.",
   bot: "Detectamos atividade suspeita.",
   blocked: "Não conseguimos processar agora.",
   network: "Falha de rede. Tenta de novo.",
};

export function WaitlistForm() {
   const [storedEmail, setStoredEmail] = useLocalStorage<string | null>(
      STORAGE_KEY,
      null,
   );

   const form = useForm({
      defaultValues: { email: "" },
      validators: { onSubmit: waitlistSchema },
      onSubmit: async ({ value }) => {
         const trimmed = value.email.trim().toLowerCase();
         const ph = typeof window !== "undefined" ? window.posthog : undefined;
         const distinctId = ph?.__loaded ? ph.get_distinct_id() : trimmed;

         const fetched = await fromPromise(
            fetch("/api/waitlist", {
               method: "POST",
               headers: { "content-type": "application/json" },
               body: JSON.stringify({ email: trimmed, distinctId }),
            }),
            () => "network" as const,
         );
         if (fetched.isErr()) {
            ph?.capture("waitlist_rejected", {
               reason: "network",
               source: "landing",
            });
            return { fields: { email: errorMessages.network } };
         }
         const res = fetched.value;
         const parsed = await fromPromise(res.json(), () => null);
         const json: { ok?: boolean; reason?: string } =
            parsed.unwrapOr(null) ?? {};
         if (!res.ok || !json.ok) {
            const reason = json.reason ?? "blocked";
            ph?.capture("waitlist_rejected", { reason, source: "landing" });
            return {
               fields: {
                  email: errorMessages[reason] ?? errorMessages.blocked,
               },
            };
         }

         if (ph?.__loaded) {
            ph.identify(trimmed, {
               email: trimmed,
               waitlist_source: "landing",
            });
            ph.capture("waitlist", { email: trimmed, source: "landing" });
         }

         setStoredEmail(trimmed);
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
                  className="flex min-h-12 items-center gap-2 border border-primary/50 bg-primary/10 px-4 py-2"
               >
                  <Check
                     className="size-4 shrink-0 text-primary"
                     aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1">
                     <p className="text-sm font-medium text-foreground">
                        Você já está na lista.
                     </p>
                     <p className="text-xs text-muted-foreground">
                        Avisaremos {storedEmail} quando os próximos convites
                        saírem.
                     </p>
                  </div>
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
