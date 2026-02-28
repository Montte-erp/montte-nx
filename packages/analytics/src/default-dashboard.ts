import type { TrendsConfig } from "./types";

interface DefaultInsightDef {
   name: string;
   description: string;
   type: "trends" | "funnels" | "retention";
   config: TrendsConfig; // all default insights are trends for now
   defaultSize: "sm" | "md" | "lg" | "full";
}

export const DEFAULT_INSIGHTS: DefaultInsightDef[] = [
   {
      name: "Transactions this month",
      description: "Total transactions recorded in the current month",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.transaction_created",
               math: "count",
               label: "Transactions",
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
      name: "Income vs Expenses",
      description: "Income and expense breakdown for the current month",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.transaction_created",
               math: "count",
               label: "Movements",
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
      name: "Spending Trend",
      description: "Transaction history over the last 6 months",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.transaction_created",
               math: "count",
               label: "Transactions",
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
      name: "Connected Accounts",
      description: "Bank accounts connected over time",
      type: "trends",
      config: {
         type: "trends",
         series: [
            {
               event: "finance.bank_account_connected",
               math: "count",
               label: "Accounts",
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
      name: "AI Usage",
      description: "AI feature usage over the last 30 days",
      type: "trends",
      config: {
         type: "trends",
         series: [
            { event: "ai.completion", math: "count", label: "Completions" },
            {
               event: "ai.chat_message",
               math: "count",
               label: "Chat Messages",
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
