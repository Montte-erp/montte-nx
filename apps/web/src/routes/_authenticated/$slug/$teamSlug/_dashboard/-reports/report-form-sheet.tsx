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
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { type Collection } from "@tanstack/react-db";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { fromPromise } from "neverthrow";
import { useMemo } from "react";
import { z } from "zod";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import {
   buildOptimisticReportRow,
   buildReportCollectionRowId,
   createReportAction,
   type ReportCreateInput,
   type ReportRow,
} from "@/integrations/tanstack-db/reports";
import { REPORT_LABELS, type ReportType } from "./report-labels";

const REPORT_TYPES = [
   "dre",
   "cash-flow",
   "cost-centers",
   "aging",
   "categories",
] as const;
dayjs.extend(customParseFormat);

const STATUSES = ["paid", "pending", "all"] as const;
type ReportStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<ReportStatus, string> = {
   paid: "Realizados",
   pending: "Planejados",
   all: "Ambos",
};

const formSchema = z
   .object({
      name: z
         .string()
         .trim()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres."),
      type: z.enum(REPORT_TYPES),
      dateFrom: z
         .string()
         .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida."),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida."),
      status: z.enum(STATUSES),
   })
   .refine((v) => dayjs(v.dateFrom, "YYYY-MM-DD", true).isValid(), {
      path: ["dateFrom"],
      message: "Data inicial inválida.",
   })
   .refine((v) => dayjs(v.dateTo, "YYYY-MM-DD", true).isValid(), {
      path: ["dateTo"],
      message: "Data final inválida.",
   })
   .refine((v) => v.dateFrom <= v.dateTo, {
      path: ["dateTo"],
      message: "Data final deve ser maior ou igual à inicial.",
   });

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   name: "",
   type: "dre",
   dateFrom: dayjs().startOf("month").format("YYYY-MM-DD"),
   dateTo: dayjs().endOf("month").format("YYYY-MM-DD"),
   status: "paid",
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function parseReportType(value: string): ReportType | undefined {
   return REPORT_TYPES.find((type) => type === value);
}

function parseStatus(value: string): ReportStatus | undefined {
   return STATUSES.find((status) => status === value);
}

type ReportFormSheetProps = {
   collection: Collection<ReportRow, string>;
   teamId: string;
};

export function ReportFormSheet({ collection, teamId }: ReportFormSheetProps) {
   const { closeTopSheet } = useSheet();
   const navigate = useNavigate();
   const { slug, teamSlug } = useDashboardSlugs();
   const createReport = useMemo(
      () => createReportAction(collection),
      [collection],
   );

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const input: ReportCreateInput = {
            name: value.name.trim(),
            type: value.type,
            config: {
               dateFrom: value.dateFrom,
               dateTo: value.dateTo,
               status: value.status,
               dreOnly: true,
               agingType: "all",
               agingStatus: "open",
               categoryDepth: "group",
               minAmount: 0,
            },
         };
         const create = createReport({
            row: buildOptimisticReportRow({
               id: buildReportCollectionRowId(),
               input,
               teamId,
            }),
            input,
         });
         const result = await fromPromise(
            create.isPersisted.promise,
            (error) => error,
         );
         if (result.isErr()) {
            const message =
               result.error instanceof Error
                  ? result.error.message
                  : "Não foi possível criar o relatório.";
            toast.error(message);
            return;
         }

         const report = result.value;
         toast.success("Relatório criado.");
         closeTopSheet();
         navigate({
            to: "/$slug/$teamSlug/reports/$reportId",
            params: { slug, teamSlug, reportId: report.id },
         });
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo relatório</SheetTitle>
            <SheetDescription>
               Salve uma configuração para consultar quando precisar.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="name">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="Ex.: DRE mensal"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Field name="type">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => {
                           const parsed = parseReportType(v);
                           if (!parsed) return;
                           field.handleChange(parsed);
                        }}
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                        >
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {REPORT_TYPES.map((value) => {
                              const Icon = REPORT_LABELS[value].icon;
                              return (
                                 <SelectItem key={value} value={value}>
                                    <span className="flex items-center gap-2">
                                       <Icon className="size-4" />
                                       {REPORT_LABELS[value].label}
                                    </span>
                                 </SelectItem>
                              );
                           })}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>

            <div className="grid grid-cols-2 gap-4">
               <form.Field name="dateFrom">
                  {(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name}>Início</FieldLabel>
                        <Input
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                           type="date"
                           value={field.state.value}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {isFieldInvalid(field) ? (
                           <FieldError>
                              {field.state.meta.errors[0]?.message}
                           </FieldError>
                        ) : null}
                     </Field>
                  )}
               </form.Field>

               <form.Field name="dateTo">
                  {(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name}>Fim</FieldLabel>
                        <Input
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                           type="date"
                           value={field.state.value}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                        />
                        {isFieldInvalid(field) ? (
                           <FieldError>
                              {field.state.meta.errors[0]?.message}
                           </FieldError>
                        ) : null}
                     </Field>
                  )}
               </form.Field>
            </div>

            <form.Field name="status">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => {
                           const parsed = parseStatus(v);
                           if (!parsed) return;
                           field.handleChange(parsed);
                        }}
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                        >
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {STATUSES.map((value) => (
                              <SelectItem key={value} value={value}>
                                 {STATUS_LABELS[value]}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>
         </form>

         <SheetFooter>
            <SheetClose asChild>
               <Button variant="outline">Cancelar</Button>
            </SheetClose>
            <form.Subscribe
               selector={(s) => ({
                  canSubmit: s.canSubmit,
                  isSubmitting: s.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     Criar relatório
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
