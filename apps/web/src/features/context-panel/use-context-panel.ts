import { useStore } from "@tanstack/react-store";
import type React from "react";
import { useEffect } from "react";
import { type ContextPanelTab, type PanelAction, contextPanelStore } from "./context-panel-store";

export const openContextPanel = () =>
   contextPanelStore.setState((s) => ({ ...s, isOpen: true }));

export const closeContextPanel = () =>
   contextPanelStore.setState((s) => ({ ...s, isOpen: false }));

export const toggleContextPanel = () =>
   contextPanelStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));

export const setActiveTab = (id: string) =>
   contextPanelStore.setState((s) => ({ ...s, activeTabId: id }));

export const registerTab = (tab: ContextPanelTab) =>
   contextPanelStore.setState((s) => {
      const exists = s.dynamicTabs.some((t) => t.id === tab.id);
      const updated = exists
         ? s.dynamicTabs.map((t) => (t.id === tab.id ? tab : t))
         : [...s.dynamicTabs, tab];
      return { ...s, dynamicTabs: updated };
   });

export const unregisterTab = (id: string) =>
   contextPanelStore.setState((s) => {
      const remaining = s.dynamicTabs.filter((t) => t.id !== id);
      const activeTabId = s.activeTabId === id ? "info" : s.activeTabId;
      return { ...s, dynamicTabs: remaining, activeTabId };
   });

export const setInfoContent = (content: React.ReactNode) =>
   contextPanelStore.setState((s) => ({ ...s, infoContent: content }));

export const clearInfoContent = () =>
   contextPanelStore.setState((s) => ({ ...s, infoContent: null }));

export const setPageActions = (actions: PanelAction[] | null) =>
   contextPanelStore.setState((s) => ({ ...s, pageActions: actions }));

export const clearPageActions = () =>
   contextPanelStore.setState((s) => ({ ...s, pageActions: null }));

export const setPageViewSwitch = (node: React.ReactNode) =>
   contextPanelStore.setState((s) => ({ ...s, pageViewSwitch: node }));

export const clearPageViewSwitch = () =>
   contextPanelStore.setState((s) => ({ ...s, pageViewSwitch: null }));

export const useContextPanelInfo = (content: React.ReactNode) => {
   // biome-ignore lint/correctness/useExhaustiveDependencies: content is intentionally stable on mount
   useEffect(() => {
      setInfoContent(content);
      return () => clearInfoContent();
   }, []);
};

// No dep array — always stores the latest actions so handlers that close over
// mutable state (e.g. filter values) are never stale.
export const usePageActions = (actions: PanelAction[] | null) => {
   useEffect(() => {
      setPageActions(actions);
   });
   useEffect(() => {
      return () => clearPageActions();
   }, []);
};

// No dep array — keeps viewSwitch node fresh (e.g. currentView state).
export const usePageViewSwitch = (node: React.ReactNode) => {
   useEffect(() => {
      setPageViewSwitch(node);
   });
   useEffect(() => {
      return () => clearPageViewSwitch();
   }, []);
};

export const useContextPanel = () => {
   const { isOpen, activeTabId, dynamicTabs, infoContent, pageActions, pageViewSwitch } =
      useStore(contextPanelStore);
   return {
      isOpen,
      activeTabId,
      dynamicTabs,
      infoContent,
      pageActions,
      pageViewSwitch,
      openContextPanel,
      closeContextPanel,
      toggleContextPanel,
      setActiveTab,
      registerTab,
      unregisterTab,
      setInfoContent,
      clearInfoContent,
      setPageActions,
      clearPageActions,
      setPageViewSwitch,
      clearPageViewSwitch,
   };
};
