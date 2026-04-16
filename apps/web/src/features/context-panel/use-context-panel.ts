import { useStore, shallow } from "@tanstack/react-store";
import type React from "react";
import { useEffect } from "react";
import {
   type ContextPanelTab,
   contextPanelStore,
   type PageViewSwitchConfig,
   type PanelAction,
} from "./context-panel-store";

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

export const setInfoContent = (render: (() => React.ReactNode) | null) =>
   contextPanelStore.setState((s) => ({ ...s, renderInfoContent: render }));

export const clearInfoContent = () =>
   contextPanelStore.setState((s) => ({ ...s, renderInfoContent: null }));

export const setPageActions = (actions: PanelAction[] | null) =>
   contextPanelStore.setState((s) => ({ ...s, pageActions: actions }));

export const clearPageActions = () =>
   contextPanelStore.setState((s) => ({ ...s, pageActions: null }));

export const setPageViewSwitch = (config: PageViewSwitchConfig | null) =>
   contextPanelStore.setState((s) => ({ ...s, pageViewSwitch: config }));

export const clearPageViewSwitch = () =>
   contextPanelStore.setState((s) => ({ ...s, pageViewSwitch: null }));

// No dep array — always stores the latest render function so values
// closed over by the callback (e.g. name, type, isCreating) stay fresh.
export const useContextPanelInfo = (render: () => React.ReactNode) => {
   useEffect(() => {
      setInfoContent(render);
   });
   useEffect(() => {
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

// No dep array — keeps viewSwitch config fresh (e.g. currentView state).
export const usePageViewSwitch = (config: PageViewSwitchConfig | null) => {
   useEffect(() => {
      setPageViewSwitch(config);
   });
   useEffect(() => {
      return () => clearPageViewSwitch();
   }, []);
};

export const useContextPanelOpen = () =>
   useStore(contextPanelStore, (s) => s.isOpen);

export const useContextPanelTabs = () =>
   useStore(
      contextPanelStore,
      (s) => ({
         activeTabId: s.activeTabId,
         dynamicTabs: s.dynamicTabs,
      }),
      shallow,
   );

export const useContextPanelActiveTabId = () =>
   useStore(contextPanelStore, (s) => s.activeTabId);

export const useContextPanel = () => {
   const {
      isOpen,
      activeTabId,
      dynamicTabs,
      renderInfoContent,
      pageActions,
      pageViewSwitch,
   } = useStore(contextPanelStore, (s) => s, shallow);
   return {
      isOpen,
      activeTabId,
      dynamicTabs,
      renderInfoContent,
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
