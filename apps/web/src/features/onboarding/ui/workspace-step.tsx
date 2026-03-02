import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { createSlug } from "@packages/utils/text";
import { useForm } from "@tanstack/react-form";
import {
   type FormEvent,
   forwardRef,
   useCallback,
   useEffect,
   useImperativeHandle,
   useTransition,
} from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { useMutation } from "@tanstack/react-query";
import type { AccountType } from "./account-type-step";
import type { StepHandle, StepState } from "./step-handle";

const workspaceSchema = z.object({
   workspaceName: z
      .string()
      .min(2, "O nome do workspace deve ter no mínimo 2 caracteres."),
});

interface WorkspaceStepProps {
   accountType: AccountType;
   onNext: (result: { orgSlug: string; teamSlug: string }) => void;
   onStateChange: (state: StepState) => void;
   onSlugChange?: (slug: string | null) => void;
}

export const WorkspaceStep = forwardRef<StepHandle, WorkspaceStepProps>(
   function WorkspaceStep(
      { accountType, onNext, onStateChange, onSlugChange },
      ref,
   ) {
      const [isPending, startTransition] = useTransition();

      const createWorkspace = useMutation(
         orpc.onboarding.createWorkspace.mutationOptions(),
      );

      const form = useForm({
         defaultValues: {
            workspaceName: "",
         },
         onSubmit: async ({ value }) => {
            try {
               console.log("[WorkspaceStep] Calling createWorkspace mutation");
               const result = await createWorkspace.mutateAsync({
                  workspaceName: value.workspaceName,
                  accountType,
               });
               console.log("[WorkspaceStep] Mutation complete:", result);

               console.log("[WorkspaceStep] Calling setActive:", result.orgId);
               await authClient.organization.setActive({
                  organizationId: result.orgId,
               });
               console.log("[WorkspaceStep] setActive done");

               console.log("[WorkspaceStep] Calling setActiveTeam:", result.teamId);
               await authClient.organization.setActiveTeam({
                  teamId: result.teamId,
               });
               console.log("[WorkspaceStep] setActiveTeam done");

               onNext({ orgSlug: result.orgSlug, teamSlug: result.teamSlug });
            } catch (error) {
               toast.error(
                  error instanceof Error
                     ? error.message
                     : "Erro ao criar espaço.",
               );
            }
         },
         validators: { onBlur: workspaceSchema },
      });

      useImperativeHandle(
         ref,
         () => ({
            submit: async () => {
               await form.handleSubmit();
               return !createWorkspace.isError;
            },
            canContinue: true,
            isPending,
         }),
         [form, isPending, createWorkspace.isError],
      );

      useEffect(() => {
         onStateChange({ canContinue: true, isPending });
      }, [isPending, onStateChange]);

      const handleSubmit = useCallback(
         (e: FormEvent) => {
            e.preventDefault();
            e.stopPropagation();
            startTransition(async () => {
               await form.handleSubmit();
            });
         },
         [form, startTransition],
      );

      return (
         <div className="space-y-6">
            <div className="space-y-2 text-center">
               <h2 className="font-serif text-2xl font-semibold">
                  Crie seu espaço
               </h2>
               <p className="text-sm text-muted-foreground">
                  Como você quer chamar seu espaço financeiro?
               </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
               <FieldGroup>
                  <form.Field name="workspaceName">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Nome do Workspace
                              </FieldLabel>
                              <Input
                                 aria-invalid={isInvalid}
                                 autoComplete="organization"
                                 autoFocus
                                 disabled={isPending}
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) => {
                                    field.handleChange(e.target.value);
                                    const slug =
                                       e.target.value.length >= 2
                                          ? createSlug(e.target.value)
                                          : null;
                                    onSlugChange?.(slug);
                                 }}
                                 placeholder="Ex: Minha Empresa"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>
            </form>
         </div>
      );
   },
);
