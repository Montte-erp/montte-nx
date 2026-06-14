import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaClose,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Table } from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import {
   CheckCircle2,
   ExternalLink,
   KeyRound,
   Loader2,
   Plus,
   ReceiptText,
} from "lucide-react";
import { Fragment, useMemo } from "react";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { QueryBoundary } from "@/components/query-boundary";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import { orpc, type Outputs } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../-layout/default-header";

const environmentSchema = z.enum(["homologation", "production"]);

const credentialSchema = z.object({
   environment: environmentSchema,
   issuerTaxId: z.string().trim().min(14).max(18),
   municipalRegistration: z.string().trim().min(1),
   username: z.email(),
   password: z.string().min(1),
});

const issueSchema = z.object({
   environment: environmentSchema,
   series: z.string().trim().min(1),
   number: z.string().trim().min(1),
   issuerLegalName: z.string().trim().min(1),
   customerLegalName: z.string().trim().min(1),
   customerDocument: z.string().trim().min(11).max(18),
   serviceDescription: z.string().trim().min(1),
   serviceListCode: z.string().trim().min(1),
   amount: z
      .string()
      .trim()
      .regex(/^\d+([,.]\d{2})?$/),
});

type CredentialFormValues = z.infer<typeof credentialSchema>;
type IssueFormValues = z.infer<typeof issueSchema>;
type FiscalDocumentRow = Outputs["fiscal"]["listDocuments"][number];

type SupportedPortalRow = {
   id: string;
   portal: string;
   municipio: string;
   tipo: string;
   padrao: string;
   status: string;
};

type FieldApi = {
   name: string;
   state: {
      value: string;
      meta: { isTouched: boolean; errors: unknown[] };
   };
   handleBlur: () => void;
   handleChange: (value: string) => void;
};

const credentialDefaultValues: CredentialFormValues = {
   environment: "homologation",
   issuerTaxId: "",
   municipalRegistration: "",
   username: "",
   password: "",
};

const issueDefaultValues: IssueFormValues = {
   environment: "homologation",
   series: "1",
   number: "1",
   issuerLegalName: "",
   customerLegalName: "",
   customerDocument: "",
   serviceDescription: "",
   serviceListCode: "01.05",
   amount: "150.00",
};

const supportedPortals: SupportedPortalRow[] = [
   {
      id: "jacobina-saatri",
      portal: "SAATRI",
      municipio: "Jacobina/BA",
      tipo: "NFS-e",
      padrao: "ABRASF 2.03",
      status: "Disponível",
   },
];

function getFieldErrorMessage(error: unknown) {
   if (typeof error === "string") return error;
   if (error && typeof error === "object" && "message" in error) {
      const message = error.message;
      if (typeof message === "string") return message;
   }
   return "Campo inválido.";
}

function isFieldInvalid(field: FieldApi) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function cleanDigits(value: string) {
   return value.replace(/\D/g, "");
}

function normalizeMoney(value: string) {
   const normalized = value.replace(",", ".");
   return normalized.includes(".") ? normalized : `${normalized}.00`;
}

function getStatusLabel(status: string) {
   switch (status) {
      case "draft":
         return "Rascunho";
      case "queued":
         return "Na fila";
      case "sending":
         return "Enviando";
      case "accepted_pending_authorization":
         return "Recebida";
      case "authorized":
         return "Autorizada";
      case "rejected":
         return "Rejeitada";
      case "cancellation_queued":
         return "Cancelando";
      case "cancelled":
         return "Cancelada";
      case "technical_error_retryable":
         return "Erro técnico";
      case "technical_error_terminal":
         return "Erro terminal";
      default:
         return status;
   }
}

function getEnvironmentLabel(environment: string) {
   return environment === "production" ? "Produção" : "Homologação";
}

function FiscalStatusBadge({ status }: { status: string }) {
   const label = getStatusLabel(status);
   if (status === "authorized") return <Badge variant="success">{label}</Badge>;
   if (status === "rejected" || status === "technical_error_terminal") {
      return <Badge variant="destructive">{label}</Badge>;
   }
   if (status === "cancelled")
      return <Badge variant="secondary">{label}</Badge>;
   return <Badge variant="outline">{label}</Badge>;
}

function FiscalTextField({
   field,
   label,
   description,
   placeholder,
   type = "text",
}: {
   field: FieldApi;
   label: string;
   description?: string;
   placeholder?: string;
   type?: "email" | "password" | "text";
}) {
   const invalid = isFieldInvalid(field);

   return (
      <Field data-invalid={invalid || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         <Input
            aria-invalid={invalid}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={placeholder}
            type={type}
            value={field.state.value}
         />
         {description ? (
            <FieldDescription>{description}</FieldDescription>
         ) : null}
         {invalid ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}

function EnvironmentField({
   value,
   onChange,
}: {
   value: z.infer<typeof environmentSchema>;
   onChange: (value: z.infer<typeof environmentSchema>) => void;
}) {
   return (
      <Field>
         <FieldLabel>Ambiente</FieldLabel>
         <Select
            value={value}
            onValueChange={(nextValue) => {
               const parsed = environmentSchema.safeParse(nextValue);
               if (!parsed.success) return;
               onChange(parsed.data);
            }}
         >
            <SelectTrigger>
               <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="homologation">Homologação</SelectItem>
               <SelectItem value="production">Produção</SelectItem>
            </SelectContent>
         </Select>
      </Field>
   );
}

function CredentialsCredenza({ portal }: { portal: SupportedPortalRow }) {
   const { closeTopCredenza } = useCredenza();
   const mutation = useMutation(
      orpc.fiscal.configureJacobinaSaatri.mutationOptions({
         onError: () => {
            toast.error("Não foi possível salvar as credenciais fiscais.");
         },
         onSuccess: () => {
            toast.success("Credenciais fiscais salvas.");
            closeTopCredenza();
         },
      }),
   );

   const form = useForm({
      defaultValues: credentialDefaultValues,
      validators: { onChange: credentialSchema },
      onSubmit: ({ value }) =>
         mutation.mutate({
            environment: value.environment,
            issuerTaxId: cleanDigits(value.issuerTaxId),
            municipalRegistration: value.municipalRegistration.trim(),
            username: value.username.trim(),
            password: value.password,
         }),
   });

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Credenciais {portal.portal}</CredenzaTitle>
            <CredenzaDescription>
               Informe os dados de acesso do portal {portal.municipio} para
               emissão fiscal.
            </CredenzaDescription>
         </CredenzaHeader>

         <form
            className="flex flex-1 min-h-0 flex-col"
            onSubmit={(event) => {
               event.preventDefault();
               form.handleSubmit();
            }}
         >
            <CredenzaBody className="flex flex-col gap-4">
               <FieldGroup>
                  <form.Field name="environment">
                     {(field) => (
                        <EnvironmentField
                           value={field.state.value}
                           onChange={field.handleChange}
                        />
                     )}
                  </form.Field>
                  <form.Field name="issuerTaxId">
                     {(field) => (
                        <FiscalTextField
                           description="Somente números são enviados para a API."
                           field={field}
                           label="CNPJ do prestador"
                           placeholder="00.000.000/0000-00"
                        />
                     )}
                  </form.Field>
                  <form.Field name="municipalRegistration">
                     {(field) => (
                        <FiscalTextField
                           field={field}
                           label="Inscrição municipal"
                           placeholder="Ex.: 12345"
                        />
                     )}
                  </form.Field>
                  <form.Field name="username">
                     {(field) => (
                        <FiscalTextField
                           field={field}
                           label="E-mail do portal"
                           placeholder="fiscal@empresa.com.br"
                           type="email"
                        />
                     )}
                  </form.Field>
                  <form.Field name="password">
                     {(field) => (
                        <FiscalTextField
                           field={field}
                           label="Senha do portal"
                           placeholder="Senha de acesso"
                           type="password"
                        />
                     )}
                  </form.Field>
               </FieldGroup>
            </CredenzaBody>

            <CredenzaFooter>
               <CredenzaClose asChild>
                  <Button type="button" variant="outline">
                     Cancelar
                  </Button>
               </CredenzaClose>
               <form.Subscribe
                  selector={(state) => ({
                     canSubmit: state.canSubmit,
                     isSubmitting: state.isSubmitting,
                  })}
               >
                  {(state) => (
                     <Button
                        disabled={
                           !state.canSubmit ||
                           state.isSubmitting ||
                           mutation.isPending
                        }
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Salvar credenciais
                     </Button>
                  )}
               </form.Subscribe>
            </CredenzaFooter>
         </form>
      </>
   );
}

function IssueNfeSheet() {
   const { closeTopSheet } = useSheet();
   const queryClient = useQueryClient();
   const mutation = useMutation(
      orpc.fiscal.issueJacobinaNfse.mutationOptions({
         onError: () => {
            toast.error("Não foi possível emitir a NFS-e no SAATRI.");
         },
         onSuccess: (result) => {
            queryClient.invalidateQueries(
               orpc.fiscal.listDocuments.queryOptions(),
            );
            if (result.document.status === "rejected") {
               toast.error("NFS-e rejeitada pelo SAATRI.");
               return;
            }
            toast.success("NFS-e enviada ao SAATRI.");
            closeTopSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: issueDefaultValues,
      validators: { onChange: issueSchema },
      onSubmit: ({ value }) => {
         const customerDocument = cleanDigits(value.customerDocument);
         mutation.mutate({
            environment: value.environment,
            series: value.series.trim(),
            number: value.number.trim(),
            issuedAt: dayjs().toISOString(),
            issuer: {
               legalName: value.issuerLegalName.trim(),
               address: {
                  street: "Não informado",
                  number: "S/N",
                  district: "Centro",
                  cityCode: "2917706",
                  city: "Jacobina",
                  state: "BA",
                  postalCode: "44700000",
                  countryCode: "1058",
               },
            },
            customer: {
               legalName: value.customerLegalName.trim(),
               cpf:
                  customerDocument.length === 11 ? customerDocument : undefined,
               cnpj:
                  customerDocument.length === 14 ? customerDocument : undefined,
               address: {
                  street: "Não informado",
                  number: "S/N",
                  district: "Centro",
                  cityCode: "2917706",
                  city: "Jacobina",
                  state: "BA",
                  postalCode: "44700000",
                  countryCode: "1058",
               },
            },
            services: [
               {
                  description: value.serviceDescription.trim(),
                  serviceListCode: value.serviceListCode.trim(),
                  amount: normalizeMoney(value.amount),
                  taxable: true,
               },
            ],
         });
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Emitir NFS-e</SheetTitle>
            <SheetDescription>
               Emissão mínima para validar o fluxo Jacobina/SAATRI.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(event) => {
               event.preventDefault();
               form.handleSubmit();
            }}
         >
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
               O endereço padrão de Jacobina é usado neste tracer bullet. A
               emissão completa entra depois.
            </div>
            <FieldGroup>
               <form.Field name="environment">
                  {(field) => (
                     <EnvironmentField
                        value={field.state.value}
                        onChange={field.handleChange}
                     />
                  )}
               </form.Field>
               <div className="grid gap-4 md:grid-cols-2">
                  <form.Field name="series">
                     {(field) => (
                        <FiscalTextField field={field} label="Série" />
                     )}
                  </form.Field>
                  <form.Field name="number">
                     {(field) => (
                        <FiscalTextField field={field} label="Número" />
                     )}
                  </form.Field>
               </div>
               <form.Field name="issuerLegalName">
                  {(field) => (
                     <FiscalTextField
                        field={field}
                        label="Razão social do prestador"
                     />
                  )}
               </form.Field>
               <form.Field name="customerLegalName">
                  {(field) => (
                     <FiscalTextField field={field} label="Nome do tomador" />
                  )}
               </form.Field>
               <form.Field name="customerDocument">
                  {(field) => (
                     <FiscalTextField
                        description="CPF ou CNPJ."
                        field={field}
                        label="CPF/CNPJ do tomador"
                        placeholder="000.000.000-00"
                     />
                  )}
               </form.Field>
               <form.Field name="serviceDescription">
                  {(field) => (
                     <FiscalTextField
                        field={field}
                        label="Descrição do serviço"
                        placeholder="Serviço prestado"
                     />
                  )}
               </form.Field>
               <div className="grid gap-4 md:grid-cols-2">
                  <form.Field name="serviceListCode">
                     {(field) => (
                        <FiscalTextField field={field} label="Código LC 116" />
                     )}
                  </form.Field>
                  <form.Field name="amount">
                     {(field) => (
                        <FiscalTextField
                           field={field}
                           label="Valor"
                           placeholder="150,00"
                        />
                     )}
                  </form.Field>
               </div>
            </FieldGroup>

            <SheetFooter>
               <SheetClose asChild>
                  <Button type="button" variant="outline">
                     Cancelar
                  </Button>
               </SheetClose>
               <form.Subscribe
                  selector={(state) => ({
                     canSubmit: state.canSubmit,
                     isSubmitting: state.isSubmitting,
                  })}
               >
                  {(state) => (
                     <Button
                        disabled={
                           !state.canSubmit ||
                           state.isSubmitting ||
                           mutation.isPending
                        }
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Emitir
                     </Button>
                  )}
               </form.Subscribe>
            </SheetFooter>
         </form>
      </>
   );
}

function buildDocumentColumns(): ColumnDef<FiscalDocumentRow>[] {
   return [
      {
         accessorKey: "number",
         header: "Documento",
         meta: { label: "Documento" },
         cell: ({ row }) => (
            <div className="flex flex-col gap-1">
               <span className="font-medium">
                  {row.original.series}/{row.original.number}
               </span>
               <span className="text-xs text-muted-foreground">
                  {row.original.documentKind.toUpperCase()} · CNPJ{" "}
                  {row.original.issuerTaxId}
               </span>
            </div>
         ),
      },
      {
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status" },
         cell: ({ row }) => <FiscalStatusBadge status={row.original.status} />,
      },
      {
         accessorKey: "environment",
         header: "Ambiente",
         meta: { label: "Ambiente" },
         cell: ({ row }) => getEnvironmentLabel(row.original.environment),
      },
      {
         accessorKey: "protocol",
         header: "Protocolo",
         meta: { label: "Protocolo" },
         cell: ({ row }) =>
            row.original.protocol ? (
               <span className="font-mono text-xs">
                  {row.original.protocol}
               </span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "createdAt",
         header: "Emitida em",
         meta: { label: "Emitida em" },
         cell: ({ row }) =>
            dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm"),
      },
      {
         id: "actions",
         header: "Ações",
         meta: { label: "Ações" },
         cell: ({ row }) =>
            row.original.verificationUrl ? (
               <Button asChild size="sm" type="button" variant="outline">
                  <a
                     href={row.original.verificationUrl}
                     rel="noreferrer"
                     target="_blank"
                  >
                     <ExternalLink className="size-4" />
                     Verificar
                  </a>
               </Button>
            ) : (
               <Button disabled size="sm" type="button" variant="outline">
                  Verificar
               </Button>
            ),
      },
   ];
}

function DocumentsTable() {
   const { openSheet } = useSheet();
   const documentsQuery = useSuspenseQuery(
      orpc.fiscal.listDocuments.queryOptions({ input: { limit: 50 } }),
   );
   const documents = documentsQuery.data;
   const columns = useMemo(() => buildDocumentColumns(), []);
   const table = useReactTable({
      data: documents,
      columns,
      getCoreRowModel: getCoreRowModel(),
   });

   return (
      <div className="flex flex-1 min-h-0 flex-col gap-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <CheckCircle2 className="size-4" />
               {documents.length} documentos fiscais
            </div>
            <div className="flex items-center gap-2">
               <DataTableColumnVisibility table={table} />
               <Button
                  onClick={() =>
                     openSheet({
                        className: "sm:max-w-xl",
                        renderChildren: () => <IssueNfeSheet />,
                     })
                  }
                  size="icon-sm"
                  tooltip="Emitir NF-e"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Emitir NF-e</span>
               </Button>
            </div>
         </div>
         <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody<FiscalDocumentRow> table={table} />
            </Table>
            {documents.length === 0 ? (
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <ReceiptText className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum documento fiscal</EmptyTitle>
                     <EmptyDescription>
                        Emita a primeira nota depois de configurar o portal do
                        módulo.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            ) : null}
         </ScrollArea>
      </div>
   );
}

function SupportedPortalItem({ portal }: { portal: SupportedPortalRow }) {
   const { openCredenza } = useCredenza();

   return (
      <Item asChild>
         <li>
            <ItemContent>
               <ItemTitle>{portal.portal}</ItemTitle>
               <ItemDescription>
                  {portal.municipio} · {portal.tipo} · {portal.padrao}
               </ItemDescription>
            </ItemContent>
            <ItemActions>
               <span className="hidden text-sm text-muted-foreground sm:inline">
                  {portal.status}
               </span>
               <Button
                  onClick={() =>
                     openCredenza({
                        className: "sm:max-w-lg",
                        renderChildren: () => (
                           <CredentialsCredenza portal={portal} />
                        ),
                     })
                  }
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  <KeyRound className="size-4" />
                  Configurar
               </Button>
            </ItemActions>
         </li>
      </Item>
   );
}

function SupportedPortalsList() {
   return (
      <section className="flex flex-col gap-4">
         <div className="flex flex-col gap-1">
            <h2 className="text-base font-medium">Portais fiscais</h2>
            <p className="text-sm text-muted-foreground">
               Cadastre as credenciais do portal municipal usado na emissão.
            </p>
         </div>
         <ItemGroup className="overflow-hidden rounded-lg border bg-card">
            {supportedPortals.map((portal, index) => (
               <Fragment key={portal.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <SupportedPortalItem portal={portal} />
               </Fragment>
            ))}
         </ItemGroup>
      </section>
   );
}

export function NfePage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Emita e acompanhe documentos fiscais do espaço."
            title="NF-e"
         />
         <QueryBoundary
            fallback={
               <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  Carregando documentos fiscais...
               </div>
            }
            errorTitle="Erro ao carregar documentos fiscais"
         >
            <DocumentsTable />
         </QueryBoundary>
      </main>
   );
}

export function NfeModuleSettingsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col overflow-auto">
         <div className="flex w-full max-w-2xl flex-col gap-8 self-center p-8">
            <div className="flex flex-col gap-2">
               <h1 className="text-2xl font-semibold tracking-tight">
                  Módulo NF-e
               </h1>
               <p className="text-sm leading-6 text-muted-foreground">
                  Configure os portais fiscais disponíveis para este espaço.
                  Cada portal usa as próprias credenciais de emissão.
               </p>
            </div>
            <SupportedPortalsList />
         </div>
      </main>
   );
}
