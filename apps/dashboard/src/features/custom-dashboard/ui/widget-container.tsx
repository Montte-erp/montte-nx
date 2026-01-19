import type {
   AnomalyCardConfig,
   InsightConfig,
   TextCardConfig,
} from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { cn } from "@packages/ui/lib/utils";
import {
   Bookmark,
   ChartLine,
   Filter,
   Maximize2,
   Minimize2,
   MoreHorizontal,
   Pencil,
   Settings2,
   Trash2,
} from "lucide-react";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";
import type { Widget } from "../hooks/use-widget";
import { useWidgetContainer } from "../hooks/use-widget-container";
import { AnomalyWidget } from "./anomaly-widget";
import { InsightConfigDialog } from "./insight-config-dialog/insight-config-dialog";
import { InsightWidget } from "./insight-widget";
import { SaveAsInsightCredenza } from "./save-as-insight-credenza";
import { TextCardEditorCredenza } from "./text-card-editor-credenza";
import { TextCardWidget } from "./text-card-widget";
import { WidgetConfigToolbar } from "./widget-config-toolbar";

type WidgetContainerProps = {
   widget: Widget;
   onRemove: () => void;
   onUpdateConfig: (updates: Partial<InsightConfig>) => void;
   onUpdateName: (name: string) => void;
   onUpdateDescription: (description: string | null) => void;
   onChangeWidth: (newWidth: number) => void;
   onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

function renderWidgetContent(
   widget: Widget,
   onDrillDown?: (context: DrillDownContext) => void,
   onEditTextCard?: () => void,
) {
   switch (widget.type) {
      case "text_card":
         return (
            <TextCardWidget
               config={widget.config as TextCardConfig}
               onEdit={onEditTextCard}
            />
         );
      case "anomaly_card":
         return <AnomalyWidget config={widget.config as AnomalyCardConfig} />;
      default:
         return (
            <InsightWidget
               config={widget.config as InsightConfig}
               onDrillDown={onDrillDown}
               widgetId={widget.id}
            />
         );
   }
}

type InlineEditInputProps = {
   value: string;
   inputRef: React.RefObject<HTMLInputElement | null>;
   onBlur: () => void;
   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
   onKeyDown: (e: React.KeyboardEvent) => void;
   className?: string;
   placeholder?: string;
};

function InlineEditInput({
   value,
   inputRef,
   onBlur,
   onChange,
   onKeyDown,
   className,
   placeholder,
}: InlineEditInputProps) {
   return (
      <Input
         className={className}
         onBlur={onBlur}
         onChange={onChange}
         onKeyDown={onKeyDown}
         placeholder={placeholder}
         ref={inputRef}
         value={value}
      />
   );
}

type EditableTitleProps = {
   isEditing: boolean;
   value: string;
   displayValue: string;
   inputRef: React.RefObject<HTMLInputElement | null>;
   onStartEditing: () => void;
   onBlur: () => void;
   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
   onKeyDown: (e: React.KeyboardEvent) => void;
   className?: string;
};

function EditableTitle({
   isEditing,
   value,
   displayValue,
   inputRef,
   onStartEditing,
   onBlur,
   onChange,
   onKeyDown,
   className = "cursor-pointer hover:bg-muted/50 rounded py-1 inline-flex items-center gap-2 truncate",
}: EditableTitleProps) {
   if (isEditing) {
      return (
         <InlineEditInput
            className="text-sm font-medium h-7 py-1 px-2"
            inputRef={inputRef}
            onBlur={onBlur}
            onChange={onChange}
            onKeyDown={onKeyDown}
            value={value}
         />
      );
   }

   return (
      <CardTitle className={className} onClick={onStartEditing}>
         {displayValue}
         <Pencil className="size-3 text-muted-foreground shrink-0" />
      </CardTitle>
   );
}

type EditableDescriptionProps = {
   isEditing: boolean;
   value: string;
   displayValue: string | null;
   inputRef: React.RefObject<HTMLInputElement | null>;
   onStartEditing: () => void;
   onBlur: () => void;
   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
   onKeyDown: (e: React.KeyboardEvent) => void;
   className?: string;
};

function EditableDescription({
   isEditing,
   value,
   displayValue,
   inputRef,
   onStartEditing,
   onBlur,
   onChange,
   onKeyDown,
   className = "cursor-pointer hover:bg-muted/50 rounded py-1 inline-flex items-center gap-2 truncate",
}: EditableDescriptionProps) {
   if (isEditing) {
      return (
         <InlineEditInput
            className="text-xs h-6 py-1 px-2 text-muted-foreground"
            inputRef={inputRef}
            onBlur={onBlur}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Add a description..."
            value={value}
         />
      );
   }

   return (
      <CardDescription className={className} onClick={onStartEditing}>
         {displayValue || (
            <span className="italic text-muted-foreground/70">
               Add description...
            </span>
         )}
         <Pencil className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0" />
      </CardDescription>
   );
}

export function WidgetContainer({
   widget,
   onRemove,
   onUpdateConfig,
   onUpdateName,
   onUpdateDescription,
   onChangeWidth,
   onDrillDown,
}: WidgetContainerProps) {
   const isMobile = useIsMobile();

   const {
      isInsight,
      isTextCard,
      insightConfig,
      canExpand,
      canShrink,
      handleExpand,
      handleShrink,
      titleEdit,
      descriptionEdit,
      configDialogOpen,
      configDialogSection,
      setConfigDialogOpen,
      handleOpenDisplayType,
      handleOpenOptions,
      handleOpenFilters,
      handleDrillDown,
      openCredenza,
   } = useWidgetContainer({
      widget,
      onUpdateName,
      onUpdateDescription,
      onChangeWidth,
      onDrillDown,
   });

   const handleSaveAsInsight = () => {
      if (!insightConfig) return;
      openCredenza({
         children: (
            <SaveAsInsightCredenza
               config={insightConfig}
               defaultDescription={widget.description || ""}
               defaultName={widget.name}
            />
         ),
      });
   };

   const handleEditTextCard = () => {
      openCredenza({
         children: (
            <TextCardEditorCredenza
               initialContent={(widget.config as TextCardConfig).content}
               onSave={(content) => {
                  onUpdateConfig({ content } as Partial<InsightConfig>);
               }}
            />
         ),
      });
   };

   return (
      <>
         <Card className={cn("h-full  flex flex-col", isInsight && "pt-0")}>
            {/* Desktop: Config toolbar for insights */}
            {!isMobile && isInsight && insightConfig && (
               <WidgetConfigToolbar
                  canExpand={canExpand}
                  canShrink={canShrink}
                  config={insightConfig}
                  onExpand={handleExpand}
                  onOpenDisplayType={handleOpenDisplayType}
                  onOpenFilters={handleOpenFilters}
                  onOpenOptions={handleOpenOptions}
                  onRemove={onRemove}
                  onSaveAsInsight={handleSaveAsInsight}
                  onShrink={handleShrink}
               />
            )}

            <CardHeader>
               <EditableTitle
                  displayValue={widget.name}
                  inputRef={titleEdit.inputRef}
                  isEditing={titleEdit.isEditing}
                  onBlur={titleEdit.handleBlur}
                  onChange={titleEdit.handleChange}
                  onKeyDown={titleEdit.handleKeyDown}
                  onStartEditing={titleEdit.startEditing}
                  value={titleEdit.value}
               />
               <EditableDescription
                  displayValue={widget.description}
                  inputRef={descriptionEdit.inputRef}
                  isEditing={descriptionEdit.isEditing}
                  onBlur={descriptionEdit.handleBlur}
                  onChange={descriptionEdit.handleChange}
                  onKeyDown={descriptionEdit.handleKeyDown}
                  onStartEditing={descriptionEdit.startEditing}
                  value={descriptionEdit.value}
               />

               {/* Show dropdown for mobile OR text cards OR non-insight widgets on desktop */}
               {(isMobile || isTextCard || !isInsight) && (
                  <CardAction>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button
                              className="h-8 w-8 shrink-0"
                              size="icon"
                              variant="ghost"
                           >
                              <MoreHorizontal className="h-4 w-4" />
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           {/* Width controls for non-insights on desktop */}
                           {!isMobile && canExpand && (
                              <DropdownMenuItem onClick={handleExpand}>
                                 <Maximize2 className="h-4 w-4 mr-2" />
                                 Expandir
                              </DropdownMenuItem>
                           )}
                           {!isMobile && canShrink && (
                              <DropdownMenuItem onClick={handleShrink}>
                                 <Minimize2 className="h-4 w-4 mr-2" />
                                 Reduzir
                              </DropdownMenuItem>
                           )}
                           {!isMobile && (canExpand || canShrink) && (
                              <DropdownMenuSeparator />
                           )}
                           {/* Mobile: Show insight config options */}
                           {isMobile && isInsight && (
                              <>
                                 <DropdownMenuItem
                                    onClick={handleOpenDisplayType}
                                 >
                                    <ChartLine className="h-4 w-4 mr-2" />
                                    Tipo de exibição
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={handleOpenOptions}>
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    Opções
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={handleOpenFilters}>
                                    <Filter className="h-4 w-4 mr-2" />
                                    Filtros
                                 </DropdownMenuItem>
                                 <DropdownMenuItem
                                    onClick={handleSaveAsInsight}
                                 >
                                    <Bookmark className="h-4 w-4 mr-2" />
                                    Salvar como Insight
                                 </DropdownMenuItem>
                                 <DropdownMenuSeparator />
                              </>
                           )}
                           <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={onRemove}
                           >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                     </DropdownMenu>
                  </CardAction>
               )}
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-hidden">
               {renderWidgetContent(
                  widget,
                  onDrillDown ? handleDrillDown : undefined,
                  isTextCard ? handleEditTextCard : undefined,
               )}
            </CardContent>
         </Card>

         {/* Insight Config Dialog */}
         {isInsight && insightConfig && (
            <InsightConfigDialog
               config={insightConfig}
               initialSection={configDialogSection}
               onApply={onUpdateConfig}
               onOpenChange={setConfigDialogOpen}
               open={configDialogOpen}
            />
         )}
      </>
   );
}
