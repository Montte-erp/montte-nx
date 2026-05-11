import { createStore } from "@tanstack/react-store";
import { Info, type LucideIcon } from "lucide-react";
import type { ElementType, ReactNode } from "react";

export interface PanelAction {
   icon: LucideIcon;
   label: string;
   onClick: () => void;
}

export interface ContextPanelTabMeta {
   id: string;
   icon: ElementType;
   label: string;
}

interface ContextPanelState {
   isOpen: boolean;
   activeTabId: string;
   renderInfoContent: (() => ReactNode) | null;
   pageActions: PanelAction[] | null;
}

export const TAB_METAS: readonly ContextPanelTabMeta[] = [
   { id: "info", icon: Info, label: "Informações" },
];

export const contextPanelStore = createStore<ContextPanelState>({
   isOpen: false,
   activeTabId: "info",
   renderInfoContent: null,
   pageActions: null,
});
