import { Store } from "@tanstack/react-store";
import type React from "react";

export interface ContextPanelTab {
   id: string;
   icon: React.ElementType;
   label: string;
   content: React.ReactNode;
   order?: number;
}

export interface PanelAction {
   icon: React.ElementType;
   label: string;
   onClick: () => void;
}

interface ContextPanelState {
   isOpen: boolean;
   activeTabId: string;
   dynamicTabs: ContextPanelTab[];
   infoContent: React.ReactNode;
   pageActions: PanelAction[] | null;
   pageViewSwitch: React.ReactNode | null;
}

export const contextPanelStore = new Store<ContextPanelState>({
   isOpen: false,
   activeTabId: "info",
   dynamicTabs: [],
   infoContent: null,
   pageActions: null,
   pageViewSwitch: null,
});
