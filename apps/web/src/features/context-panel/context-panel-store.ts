import { Store } from "@tanstack/react-store";
import type { LucideIcon } from "lucide-react";
import type React from "react";

export interface ContextPanelTab {
   id: string;
   icon: React.ElementType;
   label: string;
   content: React.ReactNode;
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
   infoContent: React.ReactNode;
   pageActions: PanelAction[] | null;
   pageViewSwitch: PageViewSwitchConfig | null;
}

export const contextPanelStore = new Store<ContextPanelState>({
   isOpen: false,
   activeTabId: "info",
   dynamicTabs: [],
   infoContent: null,
   pageActions: null,
   pageViewSwitch: null,
});
