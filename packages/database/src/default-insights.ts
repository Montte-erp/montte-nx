// Default insights for new organizations
// Moved here to avoid circular dependency (database -> analytics -> database)

interface DefaultInsightDef {
   name: string;
   description: string;
   type: "trends" | "funnels" | "retention";
   config: Record<string, unknown>;
   defaultSize: "sm" | "md" | "lg" | "full";
}

export const DEFAULT_INSIGHTS: DefaultInsightDef[] = [
   {
      name: "Transações este mês",
      description: "Total de transações registradas no mês atual",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.transaction_created",
               math: "count",
               label: "Transações",
            },
         ],
         dateRange: { type: "relative", value: "this_month" },
         interval: "day",
         chartType: "number",
         compare: true,
         filters: [],
      },
      defaultSize: "sm",
   },
   {
      name: "Receita vs Despesas",
      description: "Comparativo de receitas e despesas no mês atual",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.transaction_created",
               math: "count",
               label: "Movimentações",
            },
         ],
         dateRange: { type: "relative", value: "this_month" },
         interval: "day",
         chartType: "bar",
         compare: false,
         filters: [],
      },
      defaultSize: "lg",
   },
   {
      name: "Tendência de gastos",
      description: "Histórico de transações nos últimos 6 meses",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.transaction_created",
               math: "count",
               label: "Transações",
            },
         ],
         dateRange: { type: "relative", value: "180d" },
         interval: "month",
         chartType: "area",
         compare: false,
         filters: [],
      },
      defaultSize: "lg",
   },
   {
      name: "Contas conectadas",
      description: "Contas bancárias conectadas ao longo do tempo",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.bank_account_connected",
               math: "count",
               label: "Contas",
            },
         ],
         dateRange: { type: "relative", value: "30d" },
         interval: "day",
         chartType: "number",
         compare: false,
         filters: [],
      },
      defaultSize: "sm",
   },
   {
      name: "Uso de IA",
      description: "Uso de recursos de IA nos últimos 30 dias",
      type: "trends",
      config: {
         type: "trends",
         series: [
            { event: "ai.completion", math: "count", label: "Conclusões" },
            {
               event: "ai.chat_message",
               math: "count",
               label: "Mensagens de Chat",
            },
         ],
         dateRange: { type: "relative", value: "30d" },
         interval: "day",
         chartType: "line",
         compare: true,
         filters: [],
      },
      defaultSize: "full",
   },
];
