import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../../../-layout/default-header";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/modules/nfe",
)({
   head: () => ({ meta: [{ title: "NF-e — Montte" }] }),
   component: ProjectModulesPage,
});

const fiscalSettingsSchema = z.object({
   dfeProvider: z.enum(["jacobina-saatri"]),
   dfeUsername: z.string().trim().min(1, "Login obrigatório").max(120),
   dfePassword: z.string().trim().max(500),
   municipalRegistration: z.string().trim().max(40),
});

function parseDfeProvider(value: string) {
   const result = fiscalSettingsSchema.shape.dfeProvider.safeParse(value);
   return result.success ? result.data : "jacobina-saatri";
}

function ProjectModulesSkeleton() {
   return (
      <div className="flex max-w-xl flex-col gap-4">
         <Skeleton className="h-56 w-full" />
      </div>
   );
}

function FiscalModuleSettings() {
   const { data: settings } = useSuspenseQuery(
      orpc.fiscal.getFiscalSettings.queryOptions({}),
   );
   const mutation = useMutation(
      orpc.fiscal.updateFiscalSettings.mutationOptions({
         onSuccess: () => toast.success("Portal fiscal configurado."),
         onError: (error) => toast.error(error.message),
      }),
   );
   const form = useForm({
      defaultValues: {
         dfeProvider: parseDfeProvider(settings.dfeProvider),
         dfeUsername: settings.dfeUsername ?? "",
         dfePassword: "",
         municipalRegistration: settings.municipalRegistration ?? "",
      },
      validators: { onSubmit: fiscalSettingsSchema },
      onSubmit: ({ value }) =>
         mutation.mutate({
            enabled: true,
            dfeProvider: value.dfeProvider,
            dfeUsername: value.dfeUsername,
            dfePassword: value.dfePassword || undefined,
            municipalRegistration: value.municipalRegistration || undefined,
         }),
   });

   return (
      <form
         className="flex max-w-xl flex-col gap-4"
         onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
         }}
      >
         <form.Field
            name="dfeProvider"
            children={(field) => (
               <Field>
                  <FieldLabel htmlFor={field.name}>Portal</FieldLabel>
                  <Select
                     disabled={mutation.isPending}
                     onValueChange={(value) => {
                        const result =
                           fiscalSettingsSchema.shape.dfeProvider.safeParse(
                              value,
                           );
                        if (result.success) field.handleChange(result.data);
                     }}
                     value={field.state.value}
                  >
                     <SelectTrigger id={field.name}>
                        <SelectValue>jacobina-saatri</SelectValue>
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="jacobina-saatri">
                           jacobina-saatri
                        </SelectItem>
                     </SelectContent>
                  </Select>
               </Field>
            )}
         />

         <div className="grid gap-4 sm:grid-cols-2">
            <form.Field
               name="dfeUsername"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;
                  return (
                     <Field>
                        <FieldLabel htmlFor={field.name} required>
                           Login
                        </FieldLabel>
                        <Input
                           aria-invalid={isInvalid}
                           disabled={mutation.isPending}
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onInput={(event) =>
                              field.handleChange(event.currentTarget.value)
                           }
                           placeholder="Usuário do portal"
                           value={field.state.value}
                        />
                        {isInvalid ? (
                           <FieldError>
                              {String(field.state.meta.errors[0])}
                           </FieldError>
                        ) : null}
                     </Field>
                  );
               }}
            />

            <form.Field
               name="dfePassword"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;
                  return (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                        <Input
                           aria-invalid={isInvalid}
                           disabled={mutation.isPending}
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onInput={(event) =>
                              field.handleChange(event.currentTarget.value)
                           }
                           placeholder={
                              settings.hasDfePassword
                                 ? "Senha configurada"
                                 : "Senha do portal"
                           }
                           type="password"
                           value={field.state.value}
                        />
                        {isInvalid ? (
                           <FieldError>
                              {String(field.state.meta.errors[0])}
                           </FieldError>
                        ) : null}
                     </Field>
                  );
               }}
            />
         </div>

         <form.Field
            name="municipalRegistration"
            children={(field) => (
               <Field>
                  <FieldLabel htmlFor={field.name}>
                     Inscrição municipal
                  </FieldLabel>
                  <Input
                     disabled={mutation.isPending}
                     id={field.name}
                     name={field.name}
                     onBlur={field.handleBlur}
                     onInput={(event) =>
                        field.handleChange(event.currentTarget.value)
                     }
                     placeholder="Opcional"
                     value={field.state.value}
                  />
               </Field>
            )}
         />

         <form.Subscribe
            selector={(state) => ({
               canSubmit: state.canSubmit,
               isSubmitting: state.isSubmitting,
            })}
         >
            {({ canSubmit, isSubmitting }) => (
               <Button
                  className="self-start"
                  disabled={!canSubmit || isSubmitting || mutation.isPending}
                  type="submit"
               >
                  Salvar portal
               </Button>
            )}
         </form.Subscribe>
      </form>
   );
}

function ProjectModulesPage() {
   return (
      <div className="flex flex-col gap-4">
         <DefaultHeader
            description="Configure o portal usado para emissão e consulta de NF-e."
            title="NF-e"
         />
         <QueryBoundary
            errorTitle="Erro ao carregar módulos"
            fallback={<ProjectModulesSkeleton />}
         >
            <FiscalModuleSettings />
         </QueryBoundary>
      </div>
   );
}
