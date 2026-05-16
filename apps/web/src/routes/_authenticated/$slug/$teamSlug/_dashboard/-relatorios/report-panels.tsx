import { format, of } from "@f-o-t/money";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CircleDollarSign } from "lucide-react";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import type { SavedReport } from "./report-labels";

type ReportConfig = SavedReport["config"];
type ProfitAndLossReport = Outputs["reports"]["profitAndLoss"];
type CashFlowReport = Outputs["reports"]["cashFlow"];
type CostCenterReport = Outputs["reports"]["expensesByCostCenter"];
type AgingReport = Outputs["reports"]["aging"];
type CategoryExpenseReport = Outputs["reports"]["expensesByCategory"];

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatPercent(value: number): string {
   return new Intl.NumberFormat("pt-BR", {
      style: "percent",
      maximumFractionDigits: 1,
   }).format(value);
}

export function ReportData({ report }: { report: SavedReport }) {
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
