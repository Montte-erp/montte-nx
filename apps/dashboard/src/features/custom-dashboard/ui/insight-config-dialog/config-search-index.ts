import type { InsightConfig } from "@packages/database/schemas/dashboards";
import {
   AreaChart,
   BarChart3,
   Calendar,
   CreditCard,
   Eye,
   Filter,
   GitCompare,
   Hash,
   Layers,
   LineChart,
   Palette,
   PieChart,
   Sparkles,
   Table2,
   Tag,
   TrendingUp,
} from "lucide-react";

export type ConfigSection =
   | "display-type"
   | "time-filters"
   | "data-filters"
   | "chart-options"
   | "advanced";

export type SearchableOption = {
   id: string;
   label: string;
   description: string;
   keywords: string[];
   section: ConfigSection;
   icon: typeof LineChart;
};

export const SECTION_INFO: Record<
   ConfigSection,
   { label: string; icon: typeof LineChart }
> = {
   "display-type": { label: "Tipo de Exibicao", icon: LineChart },
   "time-filters": { label: "Periodo", icon: Calendar },
   "data-filters": { label: "Filtros de Dados", icon: Filter },
   "chart-options": { label: "Opcoes do Grafico", icon: Eye },
   advanced: { label: "Avancado", icon: Sparkles },
};

export type ChartType = InsightConfig["chartType"];
export type DataSource = InsightConfig["dataSource"];

export type ChartTypeOption = {
   value: ChartType;
   label: string;
   description: string;
   icon: typeof LineChart;
};

export type ChartCategory = {
   name: string;
   types: ChartTypeOption[];
};

export const CHART_CATEGORIES: ChartCategory[] = [
   {
      name: "Series Temporais",
      types: [
         {
            value: "line",
            label: "Grafico de linhas",
            description: "Tendencias ao longo do tempo como uma linha continua",
            icon: LineChart,
         },
         {
            value: "area",
            label: "Grafico de area",
            description: "Tendencias ao longo do tempo como uma area sombreada",
            icon: AreaChart,
         },
         {
            value: "bar",
            label: "Grafico de barras",
            description:
               "Tendencias ao longo do tempo como barras verticais lado a lado",
            icon: BarChart3,
         },
         {
            value: "stacked_bar",
            label: "Grafico de barras empilhadas",
            description:
               "Tendencias ao longo do tempo como barras verticais empilhadas",
            icon: Layers,
         },
      ],
   },
   {
      name: "Series Cumulativas",
      types: [
         {
            value: "line_cumulative",
            label: "Linha (cumulativa)",
            description: "Acumulando valores ao longo do tempo",
            icon: TrendingUp,
         },
      ],
   },
   {
      name: "Valor Total",
      types: [
         {
            value: "stat_card",
            label: "Numero",
            description: "Um numero grande mostrando o valor total",
            icon: Hash,
         },
         {
            value: "pie",
            label: "Grafico de pizza",
            description: "Proporcoes de um todo como fatias",
            icon: PieChart,
         },
         {
            value: "bar_total",
            label: "Grafico de barras (total)",
            description: "Valores totais como barras horizontais",
            icon: BarChart3,
         },
         {
            value: "table",
            label: "Tabela",
            description: "Valores totais em uma visualizacao de tabela",
            icon: Table2,
         },
      ],
   },
];

export const CHART_TYPE_COMPATIBILITY: Record<DataSource, ChartType[]> = {
   transactions: [
      "line",
      "area",
      "bar",
      "stacked_bar",
      "line_cumulative",
      "pie",
      "donut",
      "stat_card",
      "bar_total",
      "table",
   ],
   bills: [
      "line",
      "area",
      "bar",
      "stacked_bar",
      "line_cumulative",
      "pie",
      "donut",
      "stat_card",
      "bar_total",
      "table",
   ],
   budgets: [
      "line",
      "area",
      "bar",
      "stacked_bar",
      "line_cumulative",
      "pie",
      "donut",
      "stat_card",
      "bar_total",
      "table",
   ],
   bank_accounts: ["pie", "donut", "bar", "stat_card", "bar_total", "table"],
};

// Search index for all configurable options
export const SEARCH_INDEX: SearchableOption[] = [
   // Display Type options
   {
      id: "chart-line",
      label: "Grafico de linhas",
      description: "Tendencias ao longo do tempo",
      keywords: ["linha", "line", "tendencia", "tempo", "series"],
      section: "display-type",
      icon: LineChart,
   },
   {
      id: "chart-area",
      label: "Grafico de area",
      description: "Area sombreada ao longo do tempo",
      keywords: ["area", "sombreado", "preenchido"],
      section: "display-type",
      icon: AreaChart,
   },
   {
      id: "chart-bar",
      label: "Grafico de barras",
      description: "Barras verticais",
      keywords: ["barras", "bar", "colunas", "vertical"],
      section: "display-type",
      icon: BarChart3,
   },
   {
      id: "chart-stacked-bar",
      label: "Barras empilhadas",
      description: "Barras verticais empilhadas",
      keywords: ["empilhadas", "stacked", "acumulado"],
      section: "display-type",
      icon: Layers,
   },
   {
      id: "chart-pie",
      label: "Grafico de pizza",
      description: "Proporcoes como fatias",
      keywords: ["pizza", "pie", "fatias", "proporcao", "percentual"],
      section: "display-type",
      icon: PieChart,
   },
   {
      id: "chart-stat-card",
      label: "Numero estatistico",
      description: "Valor total em destaque",
      keywords: ["numero", "stat", "kpi", "metrica", "total", "card"],
      section: "display-type",
      icon: Hash,
   },
   {
      id: "chart-table",
      label: "Tabela",
      description: "Dados em formato de tabela",
      keywords: ["tabela", "table", "lista", "dados"],
      section: "display-type",
      icon: Table2,
   },

   // Time Filters options
   {
      id: "date-range",
      label: "Periodo de datas",
      description: "Selecione o intervalo de tempo",
      keywords: ["data", "periodo", "intervalo", "range", "tempo"],
      section: "time-filters",
      icon: Calendar,
   },
   {
      id: "time-grouping",
      label: "Agrupamento temporal",
      description: "Agrupe por dia, semana, mes",
      keywords: [
         "agrupamento",
         "grupo",
         "dia",
         "semana",
         "mes",
         "trimestre",
         "ano",
      ],
      section: "time-filters",
      icon: Layers,
   },
   {
      id: "comparison",
      label: "Comparacao de periodo",
      description: "Compare com periodo anterior",
      keywords: ["comparacao", "comparar", "anterior", "ano passado"],
      section: "time-filters",
      icon: GitCompare,
   },

   // Data Filters options
   {
      id: "filter-type",
      label: "Tipo de transacao",
      description: "Filtre por receita ou despesa",
      keywords: [
         "tipo",
         "receita",
         "despesa",
         "transferencia",
         "entrada",
         "saida",
      ],
      section: "data-filters",
      icon: Filter,
   },
   {
      id: "filter-category",
      label: "Categorias",
      description: "Filtre por categorias",
      keywords: ["categoria", "categories", "classificacao"],
      section: "data-filters",
      icon: Layers,
   },
   {
      id: "filter-tag",
      label: "Tags",
      description: "Filtre por tags",
      keywords: ["tag", "etiqueta", "marcador"],
      section: "data-filters",
      icon: Tag,
   },
   {
      id: "filter-bank-account",
      label: "Conta bancaria",
      description: "Filtre por conta",
      keywords: ["conta", "banco", "bancaria", "account"],
      section: "data-filters",
      icon: CreditCard,
   },

   // Chart Options
   {
      id: "show-labels",
      label: "Mostrar valores",
      description: "Exibir valores na serie",
      keywords: ["valores", "labels", "rotulos", "numeros"],
      section: "chart-options",
      icon: Eye,
   },
   {
      id: "show-legend",
      label: "Mostrar legenda",
      description: "Exibir legenda do grafico",
      keywords: ["legenda", "legend", "identificacao"],
      section: "chart-options",
      icon: Eye,
   },
   {
      id: "show-trend-line",
      label: "Linha de tendencia",
      description: "Mostrar linha de tendencia",
      keywords: ["tendencia", "trend", "direcao"],
      section: "chart-options",
      icon: TrendingUp,
   },
   {
      id: "color-by",
      label: "Personalizacao de cores",
      description: "Cores por nome ou classificacao",
      keywords: ["cor", "cores", "color", "paleta", "tema"],
      section: "chart-options",
      icon: Palette,
   },
   {
      id: "y-axis-unit",
      label: "Unidade do eixo Y",
      description: "Moeda, percentual ou numero",
      keywords: ["eixo", "y", "unidade", "moeda", "percentual"],
      section: "chart-options",
      icon: BarChart3,
   },
   {
      id: "y-axis-scale",
      label: "Escala do eixo Y",
      description: "Linear ou logaritmica",
      keywords: ["escala", "linear", "logaritmica", "log"],
      section: "chart-options",
      icon: BarChart3,
   },
   {
      id: "mini-chart",
      label: "Mini grafico",
      description: "Sparkline no card estatistico",
      keywords: ["sparkline", "mini", "pequeno", "tendencia"],
      section: "chart-options",
      icon: Sparkles,
   },

   // Advanced options
   {
      id: "forecast",
      label: "Previsao de gastos",
      description: "Projetar valores futuros",
      keywords: ["previsao", "forecast", "futuro", "projecao", "predizer"],
      section: "advanced",
      icon: TrendingUp,
   },
   {
      id: "confidence-intervals",
      label: "Intervalos de confianca",
      description: "Mostrar margem de erro",
      keywords: ["confianca", "intervalo", "erro", "margem", "estatistica"],
      section: "advanced",
      icon: BarChart3,
   },
   {
      id: "moving-average",
      label: "Media movel",
      description: "Suavizar dados com media",
      keywords: ["media", "movel", "moving", "average", "suavizar"],
      section: "advanced",
      icon: LineChart,
   },
   {
      id: "comparison-overlay",
      label: "Sobreposicao de comparacao",
      description: "Sobrepor periodo anterior",
      keywords: ["sobreposicao", "overlay", "comparacao", "anterior"],
      section: "advanced",
      icon: GitCompare,
   },
];

export function searchOptions(query: string): SearchableOption[] {
   if (!query.trim()) return [];

   const normalizedQuery = query.toLowerCase().trim();

   return SEARCH_INDEX.filter((option) => {
      const matchLabel = option.label.toLowerCase().includes(normalizedQuery);
      const matchDescription = option.description
         .toLowerCase()
         .includes(normalizedQuery);
      const matchKeywords = option.keywords.some((keyword) =>
         keyword.toLowerCase().includes(normalizedQuery),
      );
      return matchLabel || matchDescription || matchKeywords;
   });
}

export function getChartTypeIcon(chartType: ChartType) {
   for (const category of CHART_CATEGORIES) {
      const found = category.types.find((t) => t.value === chartType);
      if (found) return found.icon;
   }
   return LineChart;
}

export function getChartTypeLabel(chartType: ChartType) {
   for (const category of CHART_CATEGORIES) {
      const found = category.types.find((t) => t.value === chartType);
      if (found) return found.label;
   }
   return "Exibicao";
}
