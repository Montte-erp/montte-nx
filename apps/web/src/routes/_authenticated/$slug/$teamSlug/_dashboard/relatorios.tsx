import { format, of } from "@f-o-t/money";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
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
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   CalendarClock,
   CircleDollarSign,
   FileDown,
   LineChart,
   PieChart,
   Plus,
   ReceiptText,
   Tags,
   Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { DefaultHeader } from "../-layout/default-header";

const reportTypeSchema = z.enum([
   "dre",
   "cash-flow",
   "cost-centers",
   "aging",
   "categories",
]);

const reportsSearchSchema = z.object({
   reportId: z.string().catch("").default(""),
});

type SavedReport = Outputs["reports"]["list"][number];
type ReportType = z.infer<typeof reportTypeSchema>;
type ReportConfig = SavedReport["config"];
type ProfitAndLossReport = Outputs["reports"]["profitAndLoss"];
type CashFlowReport = Outputs["reports"]["cashFlow"];
type CostCenterReport = Outputs["reports"]["expensesByCostCenter"];
type AgingReport = Outputs["reports"]["aging"];
type CategoryExpenseReport = Outputs["reports"]["expensesByCategory"];

const reportLabels: Record<ReportType, { label: string; icon: LucideIcon }> = {
   dre: { label: "Resultado / DRE", icon: ReceiptText },
   "cash-flow": { label: "Fluxo de caixa", icon: LineChart },
   "cost-centers": { label: "Centro de Custo", icon: Tags },
   aging: { label: "A receber / pagar", icon: CalendarClock },
   categories: { label: "Despesas por categoria", icon: PieChart },
};

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/relatorios",
)({
   validateSearch: reportsSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.reports.list.queryOptions());
   },
   pendingMs: 300,
   pendingComponent: ReportsSkeleton,
   head: () => ({
      meta: [{ title: "Relatórios — Montte" }],
   }),
   component: ReportsPage,
});

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatPercent(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      maximumFractionDigits: 1,
   }).format(value);
}

function ReportsSkeleton() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
            <div className="bg-muted h-10 w-full rounded-md" />
            <div className="bg-muted h-80 w-full rounded-md" />
         </div>
      </main>
   );
}

function ReportsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Crie relatórios salvos para visualizar e exportar"
            title="Relatórios"
         />
         <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <QueryBoundary
               fallback={<ReportsSkeleton />}
               errorTitle="Erro ao carregar relatórios"
            >
               <ReportsContent />
            </QueryBoundary>
         </div>
      </main>
   );
}

function ReportsContent() {
   const navigate = Route.useNavigate();
   const { reportId } = Route.useSearch();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const { data: reports } = useSuspenseQuery(orpc.reports.list.queryOptions());
   const selected =
      reports.find((report) => report.id === reportId) ?? reports[0];
   const removeMutation = useMutation(
      orpc.reports.remove.mutationOptions({
         onSuccess: () => toast.success("Relatório excluído."),
         onError: (error) => toast.error(error.message),
      }),
   );

   const openCreate = () =>
      openCredenza({
         className: "sm:max-w-xl",
         renderChildren: () => (
            <CreateReportForm
               onCreated={(report) => {
                  closeCredenza();
                  navigate({
                     search: (prev) => ({ ...prev, reportId: report.id }),
                     replace: true,
                  });
               }}
            />
         ),
      });

   const selectReport = (id: string) =>
      navigate({
         search: (prev) => ({ ...prev, reportId: id }),
         replace: true,
      });

   const confirmRemove = (report: SavedReport) =>
      openAlertDialog({
         title: "Excluir relatório",
         description: `Tem certeza que deseja excluir "${report.name}"?`,
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await removeMutation.mutateAsync({ id: report.id });
         },
      });

   return (
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(420px,520px)_1fr]">
         <section className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
               <h2 className="text-sm font-medium">Relatórios salvos</h2>
               <Button onClick={openCreate} size="sm" variant="outline">
                  <Plus />
                  Novo relatório
               </Button>
            </div>
            <ReportsTable
               onRemove={confirmRemove}
               onSelect={selectReport}
               reports={reports}
               selectedId={selected?.id}
            />
         </section>
         <section className="min-h-0">
            {selected ? (
               <ReportViewer report={selected} />
            ) : (
               <Empty className="rounded-md border py-4">
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <ReceiptText className="size-4" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum relatório criado</EmptyTitle>
                     <EmptyDescription>
                        Crie o primeiro relatório para visualizar os dados do
                        espaço atual.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
         </section>
      </div>
   );
}

function ReportsTable({
   onRemove,
   onSelect,
   reports,
   selectedId,
}: {
   onRemove: (report: SavedReport) => void;
   onSelect: (id: string) => void;
   reports: SavedReport[];
   selectedId?: string;
}) {
   if (reports.length === 0)
      return (
         <Empty className="rounded-md border py-4">
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <ReceiptText className="size-4" />
               </EmptyMedia>
               <EmptyTitle>Nenhum relatório</EmptyTitle>
               <EmptyDescription>
                  Use o botão de novo relatório para criar uma visão salva.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Nome</TableHead>
               <TableHead>Tipo</TableHead>
               <TableHead>Período</TableHead>
               <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
               </TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {reports.map((report) => {
               const Icon = reportLabels[report.type].icon;
               return (
                  <TableRow
                     className={
                        selectedId === report.id
                           ? "bg-muted/70 cursor-pointer"
                           : "cursor-pointer"
                     }
                     key={report.id}
                     onClick={() => onSelect(report.id)}
                  >
                     <TableCell className="font-medium">
                        {report.name}
                     </TableCell>
                     <TableCell>
                        <span className="inline-flex items-center gap-2">
                           <Icon className="text-muted-foreground size-4" />
                           {reportLabels[report.type].label}
                        </span>
                     </TableCell>
                     <TableCell className="text-muted-foreground">
                        {dayjs(report.config.dateFrom).format("DD/MM/YYYY")}-
                        {dayjs(report.config.dateTo).format("DD/MM/YYYY")}
                     </TableCell>
                     <TableCell>
                        <Button
                           onClick={(event) => {
                              event.stopPropagation();
                              onRemove(report);
                           }}
                           size="icon-sm"
                           tooltip="Excluir"
                           variant="ghost"
                        >
                           <Trash2 />
                           <span className="sr-only">Excluir</span>
                        </Button>
                     </TableCell>
                  </TableRow>
               );
            })}
         </TableBody>
      </Table>
   );
}

function CreateReportForm({
   onCreated,
}: {
   onCreated: (report: SavedReport) => void;
}) {
   const [name, setName] = useState("");
   const [type, setType] = useState<ReportType>("dre");
   const [dateFrom, setDateFrom] = useState(
      dayjs().startOf("month").format("YYYY-MM-DD"),
   );
   const [dateTo, setDateTo] = useState(
      dayjs().endOf("month").format("YYYY-MM-DD"),
   );
   const [status, setStatus] = useState<ReportConfig["status"]>("paid");
   const createMutation = useMutation(
      orpc.reports.create.mutationOptions({
         onSuccess: (report) => {
            toast.success("Relatório criado.");
            onCreated(report);
         },
         onError: (error) => toast.error(error.message),
      }),
   );

   const submit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await createMutation.mutateAsync({
         name,
         type,
         config: {
            dateFrom,
            dateTo,
            status,
            dreOnly: true,
            agingType: "income",
            agingStatus: "open",
            categoryDepth: "group",
            minAmount: 0,
         },
      });
   };

   return (
      <form className="flex flex-col gap-4" onSubmit={submit}>
         <CredenzaHeader>
            <CredenzaTitle>Novo relatório</CredenzaTitle>
            <CredenzaDescription>
               Salve uma configuração para consultar depois na tabela.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
               Nome
               <Input
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: DRE mensal"
                  required
                  value={name}
               />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
               Tipo
               <Select
                  onValueChange={(value) => {
                     const parsed = reportTypeSchema.safeParse(value);
                     if (parsed.success) setType(parsed.data);
                  }}
                  value={type}
               >
                  <SelectTrigger>
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     {Object.entries(reportLabels).map(([value, item]) => (
                        <SelectItem key={value} value={value}>
                           {item.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
               <label className="flex flex-col gap-2 text-sm font-medium">
                  Início
                  <Input
                     onChange={(event) => setDateFrom(event.target.value)}
                     required
                     type="date"
                     value={dateFrom}
                  />
               </label>
               <label className="flex flex-col gap-2 text-sm font-medium">
                  Fim
                  <Input
                     onChange={(event) => setDateTo(event.target.value)}
                     required
                     type="date"
                     value={dateTo}
                  />
               </label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-medium">
               Status
               <Select
                  onValueChange={(value) => {
                     if (
                        value === "paid" ||
                        value === "pending" ||
                        value === "all"
                     ) {
                        setStatus(value);
                     }
                  }}
                  value={status}
               >
                  <SelectTrigger>
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="paid">Realizados</SelectItem>
                     <SelectItem value="pending">Planejados</SelectItem>
                     <SelectItem value="all">Ambos</SelectItem>
                  </SelectContent>
               </Select>
            </label>
         </CredenzaBody>
         <CredenzaFooter className="justify-end">
            <Button disabled={createMutation.isPending} type="submit">
               Criar relatório
            </Button>
         </CredenzaFooter>
      </form>
   );
}

function ReportViewer({ report }: { report: SavedReport }) {
   const Icon = reportLabels[report.type].icon;
   return (
      <div className="flex min-h-0 flex-col gap-4 rounded-md border bg-background p-4">
         <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
               <span className="text-muted-foreground flex size-10 items-center justify-center rounded-md border bg-muted/30">
                  <Icon className="size-4" />
               </span>
               <div className="flex min-w-0 flex-col gap-2">
                  <h2 className="truncate text-base font-semibold">
                     {report.name}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                     {reportLabels[report.type].label} ·{" "}
                     {dayjs(report.config.dateFrom).format("DD/MM/YYYY")} -{" "}
                     {dayjs(report.config.dateTo).format("DD/MM/YYYY")}
                  </p>
               </div>
            </div>
            <Button onClick={() => window.print()} size="sm" variant="outline">
               <FileDown />
               Exportar PDF
            </Button>
         </div>
         <ReportData report={report} />
      </div>
   );
}

function ReportData({ report }: { report: SavedReport }) {
   if (report.type === "dre")
      return <ProfitAndLossData config={report.config} />;
   if (report.type === "cash-flow")
      return <CashFlowData config={report.config} />;
   if (report.type === "cost-centers")
      return <CostCentersData config={report.config} />;
   if (report.type === "aging") return <AgingData config={report.config} />;
   return <CategoryExpensesData config={report.config} />;
}

function ProfitAndLossData({ config }: { config: ReportConfig }) {
   const { data } = useSuspenseQuery(
      orpc.reports.profitAndLoss.queryOptions({
         input: {
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            status: config.status,
            bankAccountId: config.bankAccountId,
            categoryId: config.categoryId,
            tagId: config.tagId,
            contactId: config.contactId,
            dreOnly: config.dreOnly,
         },
      }),
   );
   return <ProfitAndLossPanel report={data} />;
}

function CashFlowData({ config }: { config: ReportConfig }) {
   const { data } = useSuspenseQuery(
      orpc.reports.cashFlow.queryOptions({
         input: {
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            status: config.status,
            bankAccountId: config.bankAccountId,
            categoryId: config.categoryId,
            tagId: config.tagId,
         },
      }),
   );
   return <CashFlowPanel report={data} />;
}

function CostCentersData({ config }: { config: ReportConfig }) {
   const { data } = useSuspenseQuery(
      orpc.reports.expensesByCostCenter.queryOptions({
         input: {
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            status: config.status,
            bankAccountId: config.bankAccountId,
            categoryId: config.categoryId,
            tagId: config.tagId,
         },
      }),
   );
   return <CostCentersPanel report={data} />;
}

function AgingData({ config }: { config: ReportConfig }) {
   const { data } = useSuspenseQuery(
      orpc.reports.aging.queryOptions({
         input: {
            type: config.agingType,
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            contactId: config.contactId,
            categoryId: config.categoryId,
            tagId: config.tagId,
            status: config.agingStatus,
         },
      }),
   );
   return <AgingPanel report={data} />;
}

function CategoryExpensesData({ config }: { config: ReportConfig }) {
   const { data } = useSuspenseQuery(
      orpc.reports.expensesByCategory.queryOptions({
         input: {
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            status: config.status,
            bankAccountId: config.bankAccountId,
            categoryId: config.categoryId,
            tagId: config.tagId,
            depth: config.categoryDepth,
            minAmount: config.minAmount,
         },
      }),
   );
   return <CategoryExpensesPanel report={data} />;
}

function EmptyReport({ title }: { title: string }) {
   return (
      <Empty className="rounded-md border py-4">
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <CircleDollarSign className="size-4" />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            <EmptyDescription>
               Ajuste a configuração do relatório ou registre lançamentos para
               este período.
            </EmptyDescription>
         </EmptyHeader>
      </Empty>
   );
}

function ProfitAndLossPanel({ report }: { report: ProfitAndLossReport }) {
   if (report.groups.length === 0)
      return <EmptyReport title="Nenhum dado para DRE" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Grupo</TableHead>
               {report.periods.map((period) => (
                  <TableHead className="text-right" key={period.period}>
                     {period.label}
                  </TableHead>
               ))}
               <TableHead className="text-right">Total</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.groups.map((group) => (
               <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  {group.periods.map((period) => (
                     <TableCell className="text-right" key={period.period}>
                        {formatBRL(period.amount)}
                     </TableCell>
                  ))}
                  <TableCell className="text-right font-medium">
                     {formatBRL(group.total)}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

function CashFlowPanel({ report }: { report: CashFlowReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhum dado de fluxo de caixa" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Período</TableHead>
               <TableHead className="text-right">Saldo inicial</TableHead>
               <TableHead className="text-right">Entradas</TableHead>
               <TableHead className="text-right">Saídas</TableHead>
               <TableHead className="text-right">Saldo final</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.map((row) => (
               <TableRow key={row.period}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.initialBalance)}
                  </TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.income)}
                  </TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.expense)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                     {formatBRL(row.endingBalance)}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

function CostCentersPanel({ report }: { report: CostCenterReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhuma despesa por Centro de Custo" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Centro de Custo</TableHead>
               <TableHead>Categoria</TableHead>
               <TableHead className="text-right">Valor</TableHead>
               <TableHead className="text-right">% do total</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.flatMap((row) =>
               row.categories.map((category) => (
                  <TableRow key={`${row.id}:${category.id}`}>
                     <TableCell className="font-medium">{row.name}</TableCell>
                     <TableCell>{category.name}</TableCell>
                     <TableCell className="text-right">
                        {formatBRL(category.amount)}
                     </TableCell>
                     <TableCell className="text-right">
                        {formatPercent(category.percent)}
                     </TableCell>
                  </TableRow>
               )),
            )}
         </TableBody>
      </Table>
   );
}

function AgingPanel({ report }: { report: AgingReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhum título encontrado" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Contato</TableHead>
               <TableHead>Lançamento</TableHead>
               <TableHead>Vencimento</TableHead>
               <TableHead>Centro de Custo</TableHead>
               <TableHead className="text-right">Dias</TableHead>
               <TableHead className="text-right">Valor</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.map((row) => (
               <TableRow key={row.id}>
                  <TableCell className="font-medium">
                     {row.contactName}
                  </TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>
                     {dayjs(row.dueDate).format("DD/MM/YYYY")}
                  </TableCell>
                  <TableCell>{row.tagName ?? "Sem Centro de Custo"}</TableCell>
                  <TableCell className="text-right">{row.days}</TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.amount)}
                  </TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}

function CategoryExpensesPanel({ report }: { report: CategoryExpenseReport }) {
   if (report.rows.length === 0)
      return <EmptyReport title="Nenhuma despesa por categoria" />;

   return (
      <Table>
         <TableHeader>
            <TableRow>
               <TableHead>Categoria</TableHead>
               <TableHead className="text-right">Valor</TableHead>
               <TableHead className="text-right">% do total</TableHead>
               <TableHead className="text-right">Lançamentos</TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {report.rows.map((row) => (
               <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">
                     {formatBRL(row.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                     {formatPercent(row.percent)}
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
               </TableRow>
            ))}
         </TableBody>
      </Table>
   );
}
