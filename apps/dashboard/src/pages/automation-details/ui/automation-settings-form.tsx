import type { TriggerType } from "@packages/database/schema";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Switch } from "@packages/ui/components/switch";
import { Textarea } from "@packages/ui/components/textarea";
import { TRIGGER_DEFINITIONS } from "@packages/workflows/triggers/definitions";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";

type AutomationSettings = {
   name: string;
   description: string;
   triggerType: TriggerType;
   enabled: boolean;
   priority: number;
   stopOnMatch: boolean;
};

type AutomationSettingsFormProps = {
   settings: AutomationSettings;
   onSettingsChange: (settings: Partial<AutomationSettings>) => void;
   onTriggerTypeChange?: (triggerType: TriggerType) => void;
};

const automationSettingsSchema = z.object({
   description: z.string(),
   enabled: z.boolean(),
   name: z.string().min(1, "Nome é obrigatório"),
   priority: z.number().min(0, "Prioridade deve ser maior ou igual a 0"),
   stopOnMatch: z.boolean(),
   triggerType: z.enum(["transaction.created", "transaction.updated"]),
});

export function AutomationSettingsForm({
   settings,
   onSettingsChange,
   onTriggerTypeChange,
}: AutomationSettingsFormProps) {
   const form = useForm({
      defaultValues: {
         description: settings.description,
         enabled: settings.enabled,
         name: settings.name,
         priority: settings.priority,
         stopOnMatch: settings.stopOnMatch,
         triggerType: settings.triggerType,
      },
      validators: {
         onChange: automationSettingsSchema,
      },
   });

   useEffect(() => {
      return form.store.subscribe(() => {
         const values = form.store.state.values;
         onSettingsChange({
            description: values.description,
            enabled: values.enabled,
            name: values.name,
            priority: values.priority,
            stopOnMatch: values.stopOnMatch,
            triggerType: values.triggerType as TriggerType,
         });
      });
   }, [form.store, onSettingsChange]);

   const handleTriggerTypeChange = (value: TriggerType) => {
      form.setFieldValue("triggerType", value);
      onTriggerTypeChange?.(value);
   };

   return (
      <>
         <SheetHeader>
            <SheetTitle>Configurações da Automação</SheetTitle>
            <SheetDescription>
               Configure os detalhes gerais da automação
            </SheetDescription>
         </SheetHeader>
         <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
               <FieldGroup>
                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Nome *
                              </FieldLabel>
                              <Input
                                 id={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Nome da automação"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="description">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Descrição
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Descrição opcional"
                              rows={3}
                              value={field.state.value}
                           />
                           <FieldDescription>
                              Uma descrição ajuda a identificar o propósito da
                              automação
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="triggerType">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Gatilho</FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 handleTriggerTypeChange(value as TriggerType)
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger id={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {TRIGGER_DEFINITIONS.map((def) => (
                                    <SelectItem key={def.type} value={def.type}>
                                       {def.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                           <FieldDescription>
                              O evento que dispara esta automação
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="priority">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Prioridade
                              </FieldLabel>
                              <Input
                                 id={field.name}
                                 min={0}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(Number(e.target.value))
                                 }
                                 type="number"
                                 value={field.state.value}
                              />
                              <FieldDescription>
                                 Automações com maior prioridade são executadas
                                 primeiro
                              </FieldDescription>
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>

               <div className="flex items-center justify-between rounded-md border p-3">
                  <form.Field name="enabled">
                     {(field) => (
                        <>
                           <div>
                              <FieldLabel htmlFor={field.name}>
                                 Ativa
                              </FieldLabel>
                              <p className="text-xs text-muted-foreground">
                                 A automação está ativa e será executada
                              </p>
                           </div>
                           <Switch
                              checked={field.state.value}
                              id={field.name}
                              onCheckedChange={(checked) =>
                                 field.handleChange(checked)
                              }
                           />
                        </>
                     )}
                  </form.Field>
               </div>

               <div className="flex items-center justify-between rounded-md border p-3">
                  <form.Field name="stopOnMatch">
                     {(field) => (
                        <>
                           <div>
                              <FieldLabel htmlFor={field.name}>
                                 Parar na primeira correspondência
                              </FieldLabel>
                              <p className="text-xs text-muted-foreground">
                                 Não executar outras automações após esta
                              </p>
                           </div>
                           <Switch
                              checked={field.state.value}
                              id={field.name}
                              onCheckedChange={(checked) =>
                                 field.handleChange(checked)
                              }
                           />
                        </>
                     )}
                  </form.Field>
               </div>
            </div>
         </ScrollArea>
      </>
   );
}
