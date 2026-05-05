import type { ReactNode } from "react";
import { AgentLayout } from "./agent-layout";
import { BillingLayout } from "./billing-layout";
import { HubLayout } from "./hub-layout";
import { InsightLayout } from "./insight-layout";

export type TabColor = "primary" | "chart-2" | "chart-6" | "chart-5";

export type Tab = {
   id: string;
   label: string;
   color: TabColor;
   title: string;
   left: string;
   right: ReactNode;
   render: () => ReactNode;
};

const RubiLink = (
   <a className="font-bold text-foreground underline" href="#rubi">
      Rubi IA
   </a>
);

export const tabs: Tab[] = [
   {
      id: "lugar",
      label: "Tudo no mesmo lugar",
      color: "primary",
      title: "Seu ERP inteiro num lugar só",
      left: "Financeiro, contatos, serviços e cobrança no mesmo lugar. Adeus planilha paralela e contexto perdido entre 5 abas.",
      right: (
         <>
            A {RubiLink} conecta os módulos e acha qualquer dado por cliente,
            CNPJ, documento ou operação — em segundos.
         </>
      ),
      render: HubLayout,
   },
   {
      id: "entenda",
      label: "Entenda seu negócio",
      color: "chart-2",
      title: "Decida com dados, não com achismo",
      left: "Receita, fluxo de caixa e inadimplência em dashboards prontos. Sem montar relatório, sem fórmula no Excel.",
      right: (
         <>
            Pergunte qualquer métrica à {RubiLink} — a resposta vem com base nos
            seus dados, não em palpite.
         </>
      ),
      render: InsightLayout,
   },
   {
      id: "automatize",
      label: "Automatize com IA",
      color: "chart-6",
      title: "Coloque a Rubi no piloto",
      left: "A Rubi é o agente nativo do Montte. Classifica transações, sugere cobranças e executa rotinas — sempre com revisão humana.",
      right: (
         <>
            Conecte os dados, ative os comandos e deixe a {RubiLink} no trabalho
            repetitivo. Você decide o que importa.
         </>
      ),
      render: AgentLayout,
   },
   {
      id: "cobre",
      label: "Cobre por uso",
      color: "chart-5",
      title: "Cobre exatamente o que entrega",
      left: "Modele assinatura, uso ou pacote num motor só. Meters, benefícios e cupons cobertos — sem gambiarra fiscal.",
      right: (
         <>
            Receba via Abacate Pay com Pix e cartão. A {RubiLink} monitora
            inadimplência e sugere a próxima ação.
         </>
      ),
      render: BillingLayout,
   },
];

export const CONTENT_CLASS: Record<TabColor, string> = {
   primary: "border-primary",
   "chart-2": "border-chart-2",
   "chart-6": "border-chart-6",
   "chart-5": "border-chart-5",
};

export const TRIGGER_CLASS: Record<TabColor, string> = {
   primary:
      "data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground",
   "chart-2":
      "data-[state=active]:!bg-chart-2 data-[state=active]:!text-background",
   "chart-6":
      "data-[state=active]:!bg-chart-6 data-[state=active]:!text-background",
   "chart-5":
      "data-[state=active]:!bg-chart-5 data-[state=active]:!text-background",
};
