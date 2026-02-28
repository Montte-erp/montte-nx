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
import type { StepHandle, StepState } from "./step-handle";

const workspaceSchema = z.object({
   workspaceName: z
      .string()
      .min(2, "O nome do workspace deve ter no mínimo 2 caracteres."),
});

interface WorkspaceStepProps {
   onNext: (result: { orgSlug: string; teamSlug: string }) => void;
   onStateChange: (state: StepState) => void;
   onSlugChange?: (slug: string | null) => void;
}

export const WorkspaceStep = forwardRef<StepHandle, WorkspaceStepProps>(
   function WorkspaceStep({ onNext, onStateChange, onSlugChange }, ref) {
      const [isPending, startTransition] = useTransition();

      const form = useForm({
         defaultValues: {
            workspaceName: "",
         },
         onSubmit: async ({ value }) => {
            try {
               const slug = createSlug(value.workspaceName);

               const result = await authClient.organization.create({
                  name: value.workspaceName,
                  slug,
               });

               if (!result.data?.id) {
                  throw new Error("Failed to create workspace");
               }

               const orgId = result.data.id;
               const orgSlug = result.data.slug ?? slug;

               await authClient.organization.setActive({ organizationId: orgId });

               const teamResult = await authClient.organization.createTeam({
                  name: value.workspaceName,
                  organizationId: orgId,
               });

               if (!teamResult.data?.id) {
                  throw new Error("Failed to create team");
               }

               const teamId = teamResult.data.id;

               const session = await authClient.getSession();
               if (!session?.data?.user?.id) {
                  throw new Error("No active session");
               }

               await authClient.organization.addTeamMember({
                  teamId,
                  userId: session.data.user.id,
               });

               await authClient.organization.setActiveTeam({ teamId });

               await orpc.onboarding.completeOnboarding.call({ products: ["finance"] });

               onNext({ orgSlug, teamSlug: slug });
            } catch (error) {
               toast.error(
                  error instanceof Error ? error.message : "Erro ao criar espaço.",
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
               return true;
            },
            canContinue: true,
            isPending: isPending,
         }),
         [form, isPending],
      );

      useEffect(() => {
         onStateChange({ canContinue: true, isPending: isPending });
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
