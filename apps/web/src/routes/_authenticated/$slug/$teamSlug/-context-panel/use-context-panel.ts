import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import type React from "react";
import { useEffect, useRef } from "react";
import { contextPanelStore, type PanelAction } from "./context-panel-store";

export const openContextPanel = () =>
   contextPanelStore.setState((s) => ({ ...s, isOpen: true }));

export const closeContextPanel = () =>
   contextPanelStore.setState((s) => ({ ...s, isOpen: false }));

export const setActiveTab = (id: string) =>
   contextPanelStore.setState((s) => ({ ...s, activeTabId: id }));

const setInfoContent = (render: (() => React.ReactNode) | null) =>
   contextPanelStore.setState((s) => ({ ...s, renderInfoContent: render }));

const setPageActions = (actions: PanelAction[] | null) =>
   contextPanelStore.setState((s) => ({ ...s, pageActions: actions }));

export const useContextPanelInfo = (render: () => React.ReactNode) => {
   const ref = useRef(render);
   useIsomorphicLayoutEffect(() => {
      ref.current = render;
   });
   useEffect(() => {
      setInfoContent(() => ref.current());
      return () => setInfoContent(null);
   }, []);
};

export const usePageActions = (actions: PanelAction[] | null) => {
   const ref = useRef(actions);
   useIsomorphicLayoutEffect(() => {
      ref.current = actions;
   });
   const signature = actions?.map((a) => a.label).join("|") ?? "";
   useEffect(() => {
      const snapshot = ref.current;
      if (!snapshot) {
         setPageActions(null);
         return () => setPageActions(null);
      }
      const stable = snapshot.map((a, i) => ({
         icon: a.icon,
         label: a.label,
         onClick: () => ref.current?.[i]?.onClick(),
      }));
      setPageActions(stable);
      return () => setPageActions(null);
   }, [signature]);
};
