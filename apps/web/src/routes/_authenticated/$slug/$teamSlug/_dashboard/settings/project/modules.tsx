import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { toast } from "@packages/ui/hooks/use-toast";
import { Box, ReceiptText } from "lucide-react";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../../-layout/default-header";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/modules",
)({
   head: () => ({
      meta: [{ title: "Módulos — Montte" }],
   }),
   component: ProjectModulesPage,
});

const fiscalSettingsSchema = z.object({
   enabled: z.boolean(),
   dfeEnvironment: z.enum(["homologation", "production"]),
   dfeApiBaseUrl: z.string().trim().max(500),
   dfeUsername: z.string().trim().max(120),
   dfePassword: z.string().trim().max(500),
   municipalRegistration: z.string().trim().max(40),
});

function parseDfeEnvironment(value: string) {
   const result = fiscalSettingsSchema.shape.dfeEnvironment.safeParse(value);
   if (result.success) return result.data;
   return "homologation";
}

function getEnvironmentLabel(value: "homologation" | "production") {
   if (value === "production") return "Produção";
   return "Homologação";
}

function ProjectModulesSkeleton() {
   return (
      <div className="flex max-w-2xl flex-col gap-4">
         <Skeleton className="h-8 w-40" />
         <Skeleton className="h-20 w-full" />
         <Skeleton className="h-40 w-full" />
      </div>
   );
}

function FiscalModuleSettings() {
   const { data: settings } = useSuspenseQuery(
      orpc.fiscal.getFiscalSettings.queryOptions({}),
   );
   const mutation = useMutation(
      orpc.fiscal.updateFiscalSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações fiscais salvas."),
         onError: (error) => toast.error(error.message),
      }),
   );
   const form = useForm({
      defaultValues: {
         enabled: settings.enabled,
         dfeEnvironment: parseDfeEnvironment(settings.dfeEnvironment),
         dfeApiBaseUrl: settings.dfeApiBaseUrl ?? "",
         dfeUsername: settings.dfeUsername ?? "",
         dfePassword: "",
         municipalRegistration: settings.municipalRegistration ?? "",
      },
      validators: { onSubmit: fiscalSettingsSchema },
      onSubmit: ({ value }) =>
         mutation.mutate({
            enabled: value.enabled,
            dfeEnvironment: value.dfeEnvironment,
            dfeApiBaseUrl: value.dfeApiBaseUrl || undefined,
            dfeUsername: value.dfeUsername || undefined,
            dfePassword: value.dfePassword || undefined,
            municipalRegistration: value.municipalRegistration || undefined,
         }),
   });

   return (
      <form
         className="flex max-w-2xl flex-col gap-4"
         onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
         }}
      >
         <ItemGroup>
            <Item variant="muted">
               <ItemMedia>
                  <ReceiptText className="size-4 text-amber-500" />
               </ItemMedia>
               <ItemContent className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                     <ItemTitle>Fiscal / NF-e</ItemTitle>
                     <Badge variant="outline">DFe-Kit Jacobina</Badge>
                  </div>
                  <ItemDescription>
                     Configure o portal fiscal usado para emissão e consulta.
                     Hoje o único portal suportado é o DFe-Kit de Jacobina,
                     autenticado por login e senha do portal municipal.
                  </ItemDescription>
               </ItemContent>
               <form.Field
                  name="enabled"
                  children={(field) => (
                     <Switch
                        checked={field.state.value}
                        disabled={mutation.isPending}
                        onCheckedChange={field.handleChange}
                     />
                  )}
               />
            </Item>
            <ItemSeparator />
            <Item variant="muted">
               <ItemMedia>
                  <Box className="size-4 text-muted-foreground" />
               </ItemMedia>
               <ItemContent className="min-w-0">
                  <ItemTitle>Portal fixo</ItemTitle>
                  <ItemDescription>
                     DFe-Kit Jacobina é aplicado automaticamente para este
                     módulo. Novos portais entram aqui quando forem suportados.
                  </ItemDescription>
               </ItemContent>
            </Item>
         </ItemGroup>

         <div className="grid gap-4 sm:grid-cols-2">
            <form.Field
               name="dfeEnvironment"
               children={(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Ambiente</FieldLabel>
                     <Select
                        disabled={mutation.isPending}
                        onValueChange={(value) => {
                           const result =
                              fiscalSettingsSchema.shape.dfeEnvironment.safeParse(
                                 value,
                              );
                           if (!result.success) return;
                           field.handleChange(result.data);
                        }}
                        value={field.state.value}
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue>
                              {getEnvironmentLabel(field.state.value)}
                           </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="homologation">
                              Homologação
                           </SelectItem>
                           <SelectItem value="production">Produção</SelectItem>
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            />
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
                        placeholder="Cadastro municipal em Jacobina"
                        value={field.state.value}
                     />
                  </Field>
               )}
            />
         </div>

         <form.Field
            name="dfeApiBaseUrl"
            children={(field) => {
               const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;
               return (
                  <Field>
                     <FieldLabel htmlFor={field.name}>URL da API</FieldLabel>
                     <Input
                        aria-invalid={isInvalid}
                        disabled={mutation.isPending}
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onInput={(event) =>
                           field.handleChange(event.currentTarget.value)
                        }
                        placeholder="Endpoint do DFe-Kit Jacobina"
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
            name="dfeUsername"
            children={(field) => {
               const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;
               return (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Login</FieldLabel>
                     <Input
                        aria-invalid={isInvalid}
                        disabled={mutation.isPending}
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onInput={(event) =>
                           field.handleChange(event.currentTarget.value)
                        }
                        placeholder="CPF/CNPJ ou usuário do portal de Jacobina"
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
                              ? "Senha configurada. Preencha para trocar."
                              : "Senha do portal de Jacobina"
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
                  Salvar configurações
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
            description="Configure os módulos ativos do espaço e suas dependências operacionais."
            title="Módulos"
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
