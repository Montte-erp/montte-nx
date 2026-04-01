import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useTransition } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

const formSchema = z.object({
   name: z.string().min(1, "Nome é obrigatório"),
   description: z.string(),
});

interface CreateDashboardFormProps {
   onSuccess: () => void;
}

export function CreateDashboardForm({ onSuccess }: CreateDashboardFormProps) {
   const navigate = useNavigate();
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard/analytics/dashboards/",
   });
   const [isPending, startTransition] = useTransition();

   const mutation = useMutation(orpc.dashboards.create.mutationOptions());

   const form = useForm({
      defaultValues: { name: "", description: "" },
      validators: { onChange: formSchema },
      onSubmit: async ({ value }) => {
         try {
            const result = await mutation.mutateAsync({
               name: value.name,
               description: value.description || null,
            });
            toast.success("Dashboard criado com sucesso");
            onSuccess();
            navigate({
               to: "/$slug/$teamSlug/analytics/dashboards/$dashboardId",
               params: { slug, teamSlug, dashboardId: result.id },
            });
         } catch {
            toast.error("Erro ao criar dashboard", {
               description: "Ocorreu um erro inesperado. Tente novamente.",
            });
         }
      },
   });

   const handleSubmit = useCallback(
      (e: React.FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         startTransition(async () => {
            await form.handleSubmit();
         });
      },
      [form],
   );

   return (
      <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit}>
         <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Novo dashboard</h2>
            <p className="text-sm text-muted-foreground">
               Crie um painel personalizado com seus insights.
            </p>
         </div>
         <form.Field
            name="name"
            children={(field) => {
               const isInvalid = field.state.meta.errors.length > 0;
               return (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="dashboard-name">Nome</Label>
                     <Input
                        aria-invalid={isInvalid}
                        id="dashboard-name"
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ex: Fluxo de caixa"
                        value={field.state.value}
                     />
                     {isInvalid && (
                        <p className="text-sm text-destructive">
                           {String(field.state.meta.errors[0])}
                        </p>
                     )}
                  </div>
               );
            }}
         />
         <form.Field
            name="description"
            children={(field) => {
               const isInvalid = field.state.meta.errors.length > 0;
               return (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor="dashboard-description">
                        Descrição{" "}
                        <span className="text-muted-foreground">
                           (opcional)
                        </span>
                     </Label>
                     <Textarea
                        aria-invalid={isInvalid}
                        id="dashboard-description"
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Descreva o propósito deste dashboard..."
                        rows={3}
                        value={field.state.value}
                     />
                  </div>
               );
            }}
         />
         <form.Subscribe>
            {(formState) => (
               <Button
                  disabled={!formState.canSubmit || isPending}
                  type="submit"
               >
                  {isPending && <Spinner className="size-4" />}
                  Criar dashboard
               </Button>
            )}
         </form.Subscribe>
      </form>
   );
}
