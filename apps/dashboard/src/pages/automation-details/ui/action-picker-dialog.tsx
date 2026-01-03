import type { ActionType, TriggerType } from "@packages/database/schema";
import {
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
   CommandSeparator,
} from "@packages/ui/components/command";
import {
   type ActionCategory,
   getActionsForCategory,
   getUniqueCategories,
} from "@packages/workflows/config/actions";
import {
   ArrowLeftRight,
   BarChart3,
   Bell,
   Building,
   ClipboardList,
   FileText,
   FolderTree,
   Gauge,
   GitBranch,
   Mail,
   PieChart,
   Play,
   Plus,
   StopCircle,
   Tag,
   Zap,
} from "lucide-react";
import { useMemo } from "react";

// ============================================
// Types
// ============================================

export type PickerMode =
   | { type: "all" }
   | { type: "trigger" }
   | { type: "condition" }
   | { type: "category"; category: ActionCategory };

export type PickerSelection = {
   nodeType: "trigger" | "condition" | "action";
   data: {
      triggerType?: TriggerType;
      actionType?: ActionType;
      operator?: "AND" | "OR";
   };
};

type ActionPickerDialogProps = {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   mode: PickerMode;
   onSelect: (selection: PickerSelection) => void;
   hasTrigger?: boolean;
};

// ============================================
// Icon Mappings
// ============================================

const ACTION_ICONS: Record<
   ActionType,
   React.ComponentType<{ className?: string }>
> = {
   set_category: FolderTree,
   set_cost_center: Building,
   add_tag: Tag,
   remove_tag: Tag,
   update_description: FileText,
   mark_as_transfer: ArrowLeftRight,
   create_transaction: Plus,
   fetch_bills_report: ClipboardList,
   format_data: FileText,
   send_email: Mail,
   send_push_notification: Bell,
   stop_execution: StopCircle,
   generate_custom_report: BarChart3,
   fetch_budget_report: PieChart,
   check_budget_status: Gauge,
};

const CATEGORY_META: Record<
   ActionCategory,
   { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
   categorization: { label: "Categorização", icon: FolderTree },
   tagging: { label: "Tags", icon: Tag },
   modification: { label: "Modificação", icon: FileText },
   creation: { label: "Criação", icon: Plus },
   data: { label: "Dados", icon: ClipboardList },
   transformation: { label: "Transformação", icon: FileText },
   notification: { label: "Notificações", icon: Mail },
   control: { label: "Controle", icon: StopCircle },
};

// ============================================
// Trigger Options
// ============================================

const TRIGGER_OPTIONS: Array<{
   type: TriggerType;
   label: string;
   description: string;
}> = [
   {
      type: "transaction.created",
      label: "Transação Criada",
      description: "Quando uma transação é criada",
   },
   {
      type: "transaction.updated",
      label: "Transação Atualizada",
      description: "Quando uma transação é editada",
   },
];

// ============================================
// Condition Options
// ============================================

const CONDITION_OPTIONS: Array<{
   operator: "AND" | "OR";
   label: string;
   description: string;
}> = [
   {
      operator: "AND",
      label: "E (AND)",
      description: "Todas as condições devem corresponder",
   },
   {
      operator: "OR",
      label: "OU (OR)",
      description: "Qualquer condição pode corresponder",
   },
];

// ============================================
// Component
// ============================================

export function ActionPickerDialog({
   open,
   onOpenChange,
   mode,
   onSelect,
   hasTrigger = false,
}: ActionPickerDialogProps) {
   const title = useMemo(() => {
      switch (mode.type) {
         case "all":
            return "Buscar ação...";
         case "trigger":
            return "Selecionar gatilho...";
         case "condition":
            return "Selecionar condição...";
         case "category":
            return `Buscar em ${CATEGORY_META[mode.category].label}...`;
      }
   }, [mode]);

   const handleTriggerSelect = (triggerType: TriggerType) => {
      onSelect({
         nodeType: "trigger",
         data: { triggerType },
      });
   };

   const handleConditionSelect = (operator: "AND" | "OR") => {
      onSelect({
         nodeType: "condition",
         data: { operator },
      });
   };

   const handleActionSelect = (actionType: ActionType) => {
      onSelect({
         nodeType: "action",
         data: { actionType },
      });
   };

   return (
      <CommandDialog
         description="Selecione uma opção"
         onOpenChange={onOpenChange}
         open={open}
         showCloseButton={false}
         title={title}
      >
         <CommandInput placeholder={title} />
         <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            {/* All mode - show everything grouped */}
            {mode.type === "all" && (
               <>
                  {/* Triggers */}
                  {!hasTrigger && (
                     <CommandGroup heading="Gatilhos">
                        {TRIGGER_OPTIONS.map((trigger) => (
                           <CommandItem
                              key={trigger.type}
                              onSelect={() => handleTriggerSelect(trigger.type)}
                              value={`trigger-${trigger.type}`}
                           >
                              <Zap className="size-4 text-yellow-500" />
                              <div className="flex flex-col">
                                 <span>{trigger.label}</span>
                                 <span className="text-xs text-muted-foreground">
                                    {trigger.description}
                                 </span>
                              </div>
                           </CommandItem>
                        ))}
                     </CommandGroup>
                  )}

                  {/* Conditions */}
                  <CommandGroup heading="Condições">
                     {CONDITION_OPTIONS.map((condition) => (
                        <CommandItem
                           key={condition.operator}
                           onSelect={() =>
                              handleConditionSelect(condition.operator)
                           }
                           value={`condition-${condition.operator}`}
                        >
                           <GitBranch className="size-4 text-blue-500" />
                           <div className="flex flex-col">
                              <span>{condition.label}</span>
                              <span className="text-xs text-muted-foreground">
                                 {condition.description}
                              </span>
                           </div>
                        </CommandItem>
                     ))}
                  </CommandGroup>

                  <CommandSeparator />

                  {/* All action categories */}
                  {getUniqueCategories().map((category) => {
                     const categoryMeta = CATEGORY_META[category];
                     const actions = getActionsForCategory(category);

                     return (
                        <CommandGroup
                           heading={categoryMeta.label}
                           key={category}
                        >
                           {actions.map((action) => {
                              const ActionIcon =
                                 ACTION_ICONS[action.type as ActionType] ??
                                 Play;
                              return (
                                 <CommandItem
                                    key={action.type}
                                    onSelect={() =>
                                       handleActionSelect(
                                          action.type as ActionType,
                                       )
                                    }
                                    value={`action-${action.type}-${action.label}`}
                                 >
                                    <ActionIcon className="size-4" />
                                    <div className="flex flex-col">
                                       <span>{action.label}</span>
                                       <span className="text-xs text-muted-foreground">
                                          {action.description}
                                       </span>
                                    </div>
                                 </CommandItem>
                              );
                           })}
                        </CommandGroup>
                     );
                  })}
               </>
            )}

            {/* Trigger mode */}
            {mode.type === "trigger" && (
               <CommandGroup heading="Gatilhos">
                  {TRIGGER_OPTIONS.map((trigger) => (
                     <CommandItem
                        key={trigger.type}
                        onSelect={() => handleTriggerSelect(trigger.type)}
                        value={trigger.type}
                     >
                        <Zap className="size-4 text-yellow-500" />
                        <div className="flex flex-col">
                           <span>{trigger.label}</span>
                           <span className="text-xs text-muted-foreground">
                              {trigger.description}
                           </span>
                        </div>
                     </CommandItem>
                  ))}
               </CommandGroup>
            )}

            {/* Condition mode */}
            {mode.type === "condition" && (
               <CommandGroup heading="Condições">
                  {CONDITION_OPTIONS.map((condition) => (
                     <CommandItem
                        key={condition.operator}
                        onSelect={() =>
                           handleConditionSelect(condition.operator)
                        }
                        value={condition.operator}
                     >
                        <GitBranch className="size-4 text-blue-500" />
                        <div className="flex flex-col">
                           <span>{condition.label}</span>
                           <span className="text-xs text-muted-foreground">
                              {condition.description}
                           </span>
                        </div>
                     </CommandItem>
                  ))}
               </CommandGroup>
            )}

            {/* Category mode - show specific category actions */}
            {mode.type === "category" && (
               <CommandGroup heading={CATEGORY_META[mode.category].label}>
                  {getActionsForCategory(mode.category).map((action) => {
                     const ActionIcon =
                        ACTION_ICONS[action.type as ActionType] ?? Play;
                     return (
                        <CommandItem
                           key={action.type}
                           onSelect={() =>
                              handleActionSelect(action.type as ActionType)
                           }
                           value={`${action.type}-${action.label}`}
                        >
                           <ActionIcon className="size-4" />
                           <div className="flex flex-col">
                              <span>{action.label}</span>
                              <span className="text-xs text-muted-foreground">
                                 {action.description}
                              </span>
                           </div>
                        </CommandItem>
                     );
                  })}
               </CommandGroup>
            )}
         </CommandList>
      </CommandDialog>
   );
}
