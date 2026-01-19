import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useCallback, useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import type { ConfigSection } from "../ui/insight-config-dialog/config-search-index";
import { useInlineEdit } from "./use-inline-edit";
import type { DrillDownContext } from "./use-insight-drill-down";
import type { Widget } from "./use-widget";

type UseWidgetContainerOptions = {
   widget: Widget;
   onUpdateName: (name: string) => void;
   onUpdateDescription: (description: string | null) => void;
   onChangeWidth: (newWidth: number) => void;
   onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

export function useWidgetContainer({
   widget,
   onUpdateName,
   onUpdateDescription,
   onChangeWidth,
   onDrillDown,
}: UseWidgetContainerOptions) {
   const { openCredenza } = useCredenza();

   // Widget type checks
   const isInsight = widget.type === "insight";
   const isTextCard = widget.type === "text_card";
   const insightConfig = isInsight ? (widget.config as InsightConfig) : null;

   // Config dialog state
   const [configDialogOpen, setConfigDialogOpen] = useState(false);
   const [configDialogSection, setConfigDialogSection] =
      useState<ConfigSection>("display-type");

   // Width control
   const currentWidth = widget.position.w;
   const minWidth = isTextCard ? 1 : 3;
   const maxWidth = isTextCard ? 3 : 6;
   const canExpand = currentWidth < maxWidth;
   const canShrink = currentWidth > minWidth;

   // Inline editing for title
   const titleEdit = useInlineEdit({
      initialValue: widget.name,
      onSave: onUpdateName,
   });

   // Inline editing for description
   const descriptionEdit = useInlineEdit({
      initialValue: widget.description || "",
      onSave: (value) => onUpdateDescription(value || null),
   });

   // Width handlers
   const handleExpand = useCallback(() => {
      if (canExpand) {
         onChangeWidth(currentWidth + 1);
      }
   }, [canExpand, currentWidth, onChangeWidth]);

   const handleShrink = useCallback(() => {
      if (canShrink) {
         onChangeWidth(currentWidth - 1);
      }
   }, [canShrink, currentWidth, onChangeWidth]);

   // Config dialog handlers
   const openConfigDialog = useCallback((section: ConfigSection) => {
      setConfigDialogSection(section);
      setConfigDialogOpen(true);
   }, []);

   const handleOpenDisplayType = useCallback(() => {
      openConfigDialog("display-type");
   }, [openConfigDialog]);

   const handleOpenOptions = useCallback(() => {
      openConfigDialog("chart-options");
   }, [openConfigDialog]);

   const handleOpenFilters = useCallback(() => {
      openConfigDialog("time-filters");
   }, [openConfigDialog]);

   // Drill-down handler
   const handleDrillDown = useCallback(
      (context: DrillDownContext) => {
         if (onDrillDown && isInsight) {
            onDrillDown(widget.config as InsightConfig, context);
         }
      },
      [onDrillDown, isInsight, widget.config],
   );

   return {
      // Widget type checks
      isInsight,
      isTextCard,
      insightConfig,

      // Width control
      canExpand,
      canShrink,
      handleExpand,
      handleShrink,

      // Inline editing
      titleEdit,
      descriptionEdit,

      // Config dialog
      configDialogOpen,
      configDialogSection,
      setConfigDialogOpen,
      handleOpenDisplayType,
      handleOpenOptions,
      handleOpenFilters,

      // Drill-down
      handleDrillDown,

      // Credenza
      openCredenza,
   };
}
