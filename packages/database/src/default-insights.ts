// Default insights for new organizations
// Moved here to avoid circular dependency (database -> analytics -> database)

interface DefaultInsightDef {
  name: string;
  description: string;
  type: "kpi" | "time_series" | "breakdown";
  config: Record<string, unknown>;
  defaultSize: "sm" | "md" | "lg" | "full";
}

export const DEFAULT_INSIGHTS: DefaultInsightDef[] = [
  {
    name: "Receita este mês",
    description: "Total de receitas no mês atual vs mês anterior",
    type: "kpi",
    config: {
      type: "kpi",
      measure: { aggregation: "sum" },
      filters: {
        dateRange: { type: "relative", value: "this_month" },
        transactionType: ["income"],
      },
      compare: true,
    },
    defaultSize: "sm",
  },
  {
    name: "Despesas este mês",
    description: "Total de despesas no mês atual vs mês anterior",
    type: "kpi",
    config: {
      type: "kpi",
      measure: { aggregation: "sum" },
      filters: {
        dateRange: { type: "relative", value: "this_month" },
        transactionType: ["expense"],
      },
      compare: true,
    },
    defaultSize: "sm",
  },
  {
    name: "Saldo líquido",
    description: "Total de transações no mês atual",
    type: "kpi",
    config: {
      type: "kpi",
      measure: { aggregation: "count" },
      filters: {
        dateRange: { type: "relative", value: "this_month" },
      },
      compare: true,
    },
    defaultSize: "sm",
  },
  {
    name: "Receita vs Despesas",
    description: "Comparativo mensal de receitas e despesas nos últimos 6 meses",
    type: "time_series",
    config: {
      type: "time_series",
      measure: { aggregation: "sum" },
      filters: {
        dateRange: { type: "relative", value: "180d" },
      },
      interval: "month",
      chartType: "bar",
      compare: false,
    },
    defaultSize: "lg",
  },
  {
    name: "Gastos por categoria",
    description: "Distribuição de despesas por categoria nos últimos 30 dias",
    type: "breakdown",
    config: {
      type: "breakdown",
      measure: { aggregation: "sum" },
      filters: {
        dateRange: { type: "relative", value: "30d" },
        transactionType: ["expense"],
      },
      groupBy: "category",
      limit: 10,
    },
    defaultSize: "lg",
  },
];
