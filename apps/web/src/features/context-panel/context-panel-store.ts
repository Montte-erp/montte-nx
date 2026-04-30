import { createStore } from "@tanstack/react-store";
import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { RubiMascotIcon } from "@/features/rubi-panel/rubi-mascot-icon";

export interface ContextPanelTab {
   id: string;
   icon: React.ElementType;
   label: string;
   renderContent: () => React.ReactNode;
   order?: number;
}

export interface PanelAction {
   icon: LucideIcon;
   label: string;
   onClick: () => void;
}

export interface PageViewSwitchOption {
   id: string;
   label: string;
   icon: React.ReactNode;
}

export interface PageViewSwitchConfig {
   options: PageViewSwitchOption[];
   currentView: string;
   onViewChange(id: string): void;
}

interface ContextPanelState {
   isOpen: boolean;
   activeTabId: string;
   dynamicTabs: ContextPanelTab[];
   renderInfoContent: (() => React.ReactNode) | null;
   pageActions: PanelAction[] | null;
   pageViewSwitch: PageViewSwitchConfig | null;
}

export interface ContextPanelTabMeta {
   id: string;
   icon: React.ElementType;
   label: string;
   order?: number;
}

const INFO_TAB_META: ContextPanelTabMeta = {
   id: "info",
   icon: Info,
   label: "Informações",
   order: 0,
};

const RUBI_TAB_META: ContextPanelTabMeta = {
   id: "rubi",
   icon: RubiMascotIcon,
   label: "Montte AI",
   order: 1,
};

export const contextPanelStore = createStore<ContextPanelState>({
   isOpen: false,
   activeTabId: "info",
   dynamicTabs: [],
   renderInfoContent: null,
   pageActions: null,
   pageViewSwitch: null,
});

export const allTabMetasStore = createStore(() => {
   const { dynamicTabs } = contextPanelStore.state;
   const dynamicMetas: ContextPanelTabMeta[] = dynamicTabs.map((t) => ({
      id: t.id,
      icon: t.icon,
      label: t.label,
      order: t.order,
   }));
   return [
      INFO_TAB_META,
      RUBI_TAB_META,
      ...dynamicMetas.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
   ];
});

export const activeTabMetaStore = createStore(() => {
   const allMetas = allTabMetasStore.state;
   const { activeTabId } = contextPanelStore.state;
   return allMetas.find((t) => t.id === activeTabId) ?? allMetas[0] ?? null;
});
