import type { ActionType, TriggerType } from "@packages/database/schema";
import {
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import { cn } from "@packages/ui/lib/utils";
import { Filter, Play, Zap } from "lucide-react";
import { ACTION_TYPE_LABELS, TRIGGER_TYPE_LABELS } from "../lib/types";

type NodeOption = {
   type: "trigger" | "condition" | "action";
   label: string;
   description: string;
   keywords: string[];
   data: Record<string, unknown>;
};

const triggerOptions: NodeOption[] = [
   {
      data: { triggerType: "transaction.created" },
      description: "Quando uma nova transação é criada",
      keywords: ["transação", "criada", "nova", "trigger", "gatilho"],
      label: TRIGGER_TYPE_LABELS["transaction.created"],
      type: "trigger",
   },
   {
      data: { triggerType: "transaction.updated" },
      description: "Quando uma transação é modificada",
      keywords: ["transação", "atualizada", "modificada", "trigger", "gatilho"],
      label: TRIGGER_TYPE_LABELS["transaction.updated"],
      type: "trigger",
   },
   {
      data: {
         config: { time: "09:00", timezone: "America/Sao_Paulo" },
         triggerType: "schedule.daily",
      },
      description: "Executa todos os dias no horário configurado",
      keywords: ["agendamento", "diário", "schedule", "daily", "horário"],
      label: TRIGGER_TYPE_LABELS["schedule.daily"],
      type: "trigger",
   },
   {
      data: {
         config: { dayOfWeek: 1, time: "09:00", timezone: "America/Sao_Paulo" },
         triggerType: "schedule.weekly",
      },
      description: "Executa uma vez por semana",
      keywords: ["agendamento", "semanal", "schedule", "weekly", "semana"],
      label: TRIGGER_TYPE_LABELS["schedule.weekly"],
      type: "trigger",
   },
   {
      data: {
         config: { time: "09:00", timezone: "America/Sao_Paulo" },
         triggerType: "schedule.biweekly",
      },
      description: "Executa nos dias 1 e 15 de cada mês",
      keywords: ["agendamento", "quinzenal", "schedule", "biweekly", "quinzena"],
      label: TRIGGER_TYPE_LABELS["schedule.biweekly"],
      type: "trigger",
   },
   {
      data: {
         config: { cronPattern: "", time: "09:00", timezone: "America/Sao_Paulo" },
         triggerType: "schedule.custom",
      },
      description: "Executa em padrão CRON personalizado",
      keywords: ["agendamento", "custom", "cron", "personalizado"],
      label: TRIGGER_TYPE_LABELS["schedule.custom"],
      type: "trigger",
   },
];

const conditionOptions: NodeOption[] = [
   {
      data: { operator: "AND" },
      description: "Todas as condições devem corresponder",
      keywords: ["condição", "e", "todas", "and", "filtro"],
      label: "Condição E (AND)",
      type: "condition",
   },
   {
      data: { operator: "OR" },
      description: "Qualquer condição pode corresponder",
      keywords: ["condição", "ou", "qualquer", "or", "filtro"],
      label: "Condição OU (OR)",
      type: "condition",
   },
];

const actionOptions: NodeOption[] = [
   {
      data: { actionType: "set_category" },
      description: "Atribuir uma categoria",
      keywords: ["categoria", "definir", "atribuir"],
      label: ACTION_TYPE_LABELS.set_category,
      type: "action",
   },
   {
      data: { actionType: "add_tag" },
      description: "Adicionar tags à transação",
      keywords: ["tag", "etiqueta", "adicionar", "marcador"],
      label: ACTION_TYPE_LABELS.add_tag,
      type: "action",
   },
   {
      data: { actionType: "remove_tag" },
      description: "Remover tags da transação",
      keywords: ["tag", "etiqueta", "remover", "marcador"],
      label: ACTION_TYPE_LABELS.remove_tag,
      type: "action",
   },
   {
      data: { actionType: "set_cost_center" },
      description: "Atribuir um centro de custo",
      keywords: ["centro", "custo", "definir", "atribuir"],
      label: ACTION_TYPE_LABELS.set_cost_center,
      type: "action",
   },
   {
      data: { actionType: "update_description" },
      description: "Modificar texto da descrição",
      keywords: ["descrição", "texto", "modificar", "atualizar"],
      label: ACTION_TYPE_LABELS.update_description,
      type: "action",
   },
   {
      data: { actionType: "send_push_notification" },
      description: "Enviar uma notificação push",
      keywords: ["notificação", "push", "enviar", "alerta"],
      label: ACTION_TYPE_LABELS.send_push_notification,
      type: "action",
   },
   {
      data: { actionType: "send_email" },
      description: "Enviar um e-mail",
      keywords: ["email", "e-mail", "enviar", "correio"],
      label: ACTION_TYPE_LABELS.send_email,
      type: "action",
   },
   {
      data: { actionType: "create_transaction" },
      description: "Criar uma nova transação",
      keywords: ["transação", "criar", "nova", "adicionar"],
      label: ACTION_TYPE_LABELS.create_transaction,
      type: "action",
   },
   {
      data: { actionType: "mark_as_transfer" },
      description: "Marcar transação como transferência para outra conta",
      keywords: ["transferência", "transfer", "marcar", "conta", "mover"],
      label: ACTION_TYPE_LABELS.mark_as_transfer,
      type: "action",
   },
   {
      data: { actionType: "stop_execution" },
      description: "Parar execução da regra",
      keywords: ["parar", "stop", "interromper", "cancelar"],
      label: ACTION_TYPE_LABELS.stop_execution,
      type: "action",
   },
   {
      data: { actionType: "fetch_bills_report" },
      description: "Buscar contas a pagar/receber para usar em outras ações",
      keywords: ["contas", "bills", "buscar", "fetch", "relatorio", "pagar", "receber"],
      label: ACTION_TYPE_LABELS.fetch_bills_report,
      type: "action",
   },
];

type AddNodeDialogProps = {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onSelect: (
      type: "trigger" | "condition" | "action",
      data: {
         triggerType?: TriggerType;
         actionType?: ActionType;
         operator?: "AND" | "OR";
      },
   ) => void;
   allowedTypes?: ("trigger" | "condition" | "action")[];
};

function NodeOptionItem({
   option,
   onSelect,
}: {
   option: NodeOption;
   onSelect: () => void;
}) {
   const iconColor =
      option.type === "trigger"
         ? "bg-emerald-500"
         : option.type === "condition"
           ? "bg-amber-500"
           : "bg-blue-500";

   const Icon =
      option.type === "trigger"
         ? Zap
         : option.type === "condition"
           ? Filter
           : Play;

   return (
      <CommandItem
         className="flex items-center gap-3 px-3 py-2"
         keywords={option.keywords}
         onSelect={onSelect}
         value={option.label}
      >
         <div
            className={cn(
               "flex size-8 shrink-0 items-center justify-center rounded-md text-white",
               iconColor,
            )}
         >
            <Icon className="size-4" />
         </div>
         <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground">
               {option.description}
            </span>
         </div>
      </CommandItem>
   );
}

export function AddNodeDialog({
   open,
   onOpenChange,
   onSelect,
   allowedTypes = ["trigger", "condition", "action"],
}: AddNodeDialogProps) {
   const handleSelect = (option: NodeOption) => {
      onSelect(
         option.type,
         option.data as {
            triggerType?: TriggerType;
            actionType?: ActionType;
            operator?: "AND" | "OR";
         },
      );
      onOpenChange(false);
   };

   const showTriggers = allowedTypes.includes("trigger");
   const showConditions = allowedTypes.includes("condition");
   const showActions = allowedTypes.includes("action");

   return (
      <CommandDialog onOpenChange={onOpenChange} open={open}>
         <CommandInput placeholder="Buscar nó..." />
         <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            {showTriggers && (
               <CommandGroup heading="Gatilhos">
                  {triggerOptions.map((option) => (
                     <NodeOptionItem
                        key={option.label}
                        onSelect={() => handleSelect(option)}
                        option={option}
                     />
                  ))}
               </CommandGroup>
            )}

            {showConditions && (
               <CommandGroup heading="Condições">
                  {conditionOptions.map((option) => (
                     <NodeOptionItem
                        key={option.label}
                        onSelect={() => handleSelect(option)}
                        option={option}
                     />
                  ))}
               </CommandGroup>
            )}

            {showActions && (
               <CommandGroup heading="Ações">
                  {actionOptions.map((option) => (
                     <NodeOptionItem
                        key={option.label}
                        onSelect={() => handleSelect(option)}
                        option={option}
                     />
                  ))}
               </CommandGroup>
            )}
         </CommandList>
      </CommandDialog>
   );
}
