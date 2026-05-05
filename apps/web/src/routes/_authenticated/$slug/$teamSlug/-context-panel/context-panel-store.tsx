import { createStore } from "@tanstack/react-store";
import { Info, type LucideIcon } from "lucide-react";
import type React from "react";

const MascotIcon = (props: { className?: string }) => (
   <img
      alt=""
      aria-hidden="true"
      className={props.className}
      draggable={false}
      src="/mascot.svg"
   />
);

export interface PanelAction {
   icon: LucideIcon;
   label: string;
   onClick: () => void;
}

export interface ContextPanelTabMeta {
   id: string;
   icon: React.ElementType;
   label: string;
}

interface ContextPanelState {
   isOpen: boolean;
   activeTabId: string;
   renderInfoContent: (() => React.ReactNode) | null;
   pageActions: PanelAction[] | null;
}

export const TAB_METAS: readonly ContextPanelTabMeta[] = [
   { id: "info", icon: Info, label: "Informações" },
   { id: "agent", icon: MascotIcon, label: "Montte AI" },
];

export const contextPanelStore = createStore<ContextPanelState>({
   isOpen: false,
   activeTabId: "info",
   renderInfoContent: null,
   pageActions: null,
});
