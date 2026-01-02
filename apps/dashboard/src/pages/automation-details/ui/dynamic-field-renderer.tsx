import type { EmailTemplate } from "@packages/transactional/schemas/email-builder.schema";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Field,
   FieldDescription,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { Textarea } from "@packages/ui/components/textarea";
import type { ActionField } from "@packages/workflows/schemas/action-field.schema";
import { Pencil, Tag } from "lucide-react";
import { useState } from "react";
import { useDataSourceOptions } from "../hooks/use-data-source-options";
import { EmailBuilderDialog } from "./email-builder/email-builder-dialog";

type DynamicFieldRendererProps = {
   field: ActionField;
   value: unknown;
   allValues: Record<string, unknown>;
   onChange: (value: unknown) => void;
};

/**
 * Evaluates if a field should be visible based on its `dependsOn` condition.
 */
function evaluateDependsOn(
   field: ActionField,
   allValues: Record<string, unknown>,
): boolean {
   if (!field.dependsOn) return true;

   const dependentValue = allValues[field.dependsOn.field];
   return dependentValue === field.dependsOn.value;
}

/**
 * Dynamic field renderer that renders the appropriate input component
 * based on the field type definition.
 */
export function DynamicFieldRenderer({
   field,
   value,
   allValues,
   onChange,
}: DynamicFieldRendererProps) {
   // Get data source options if applicable (must be called before any early returns)
   const dataSource =
      field.type === "select" || field.type === "multiselect"
         ? field.dataSource
         : undefined;
   const { options: dynamicOptions, isLoading } =
      useDataSourceOptions(dataSource);

   // Check dependsOn condition
   if (!evaluateDependsOn(field, allValues)) {
      return null;
   }

   // Get options - either from dataSource or from field definition
   // Type that includes optional color from dynamic sources
   type OptionWithColor = { value: string; label: string; color?: string };
   const options: OptionWithColor[] =
      dataSource && dynamicOptions.length > 0
         ? dynamicOptions
         : field.type === "select" || field.type === "multiselect"
           ? (field.options ?? [])
           : [];

   // Common field wrapper
   const renderField = (content: React.ReactNode) => (
      <FieldGroup>
         <Field>
            <FieldLabel htmlFor={field.key}>
               {field.label}
               {field.required && <span className="text-destructive"> *</span>}
            </FieldLabel>
            {content}
            {field.helpText && (
               <FieldDescription>{field.helpText}</FieldDescription>
            )}
         </Field>
      </FieldGroup>
   );

   // Render based on field type
   switch (field.type) {
      case "string":
         return renderField(
            <Input
               id={field.key}
               onChange={(e) => onChange(e.target.value)}
               placeholder={field.placeholder}
               value={(value as string) ?? field.defaultValue ?? ""}
            />,
         );

      case "number":
         return renderField(
            <Input
               id={field.key}
               max={field.max}
               min={field.min}
               onChange={(e) => {
                  const num =
                     e.target.value === "" ? undefined : Number(e.target.value);
                  onChange(num);
               }}
               placeholder={field.placeholder}
               type="number"
               value={(value as number) ?? field.defaultValue ?? ""}
            />,
         );

      case "boolean":
         return (
            <div className="flex items-center justify-between rounded-md border p-3">
               <div>
                  <FieldLabel className="font-medium">{field.label}</FieldLabel>
                  {field.helpText && (
                     <p className="text-xs text-muted-foreground">
                        {field.helpText}
                     </p>
                  )}
               </div>
               <Switch
                  checked={(value as boolean) ?? field.defaultValue ?? false}
                  onCheckedChange={(checked) => onChange(checked)}
               />
            </div>
         );

      case "select":
         if (isLoading) {
            return renderField(<Skeleton className="h-10 w-full" />);
         }

         // Use Combobox for searchable select with many options
         if (options.length > 10) {
            return renderField(
               <Combobox
                  className="w-full"
                  emptyMessage="Nenhum item encontrado"
                  onValueChange={(val) => onChange(val)}
                  options={options.map((opt) => ({
                     label: opt.label,
                     value: opt.value,
                  }))}
                  placeholder={field.placeholder ?? "Selecione..."}
                  searchPlaceholder="Buscar..."
                  value={(value as string) ?? field.defaultValue ?? ""}
               />,
            );
         }

         return renderField(
            <Select
               onValueChange={(val) => onChange(val)}
               value={(value as string) ?? field.defaultValue ?? ""}
            >
               <SelectTrigger id={field.key}>
                  <SelectValue
                     placeholder={field.placeholder ?? "Selecione..."}
                  />
               </SelectTrigger>
               <SelectContent>
                  {options.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>,
         );

      case "multiselect":
         if (isLoading) {
            return renderField(<Skeleton className="h-10 w-full" />);
         }

         return renderField(
            <MultiSelect
               className="w-full"
               emptyMessage="Nenhum item encontrado"
               onChange={(val) => onChange(val)}
               options={options.map((opt) => ({
                  label: opt.label,
                  value: opt.value,
                  icon: opt.color ? (
                     <Tag className="size-4" style={{ color: opt.color }} />
                  ) : undefined,
               }))}
               placeholder={field.placeholder ?? "Selecione..."}
               selected={(value as string[]) ?? field.defaultValue ?? []}
            />,
         );

      case "template":
         return renderField(
            <Textarea
               id={field.key}
               onChange={(e) => onChange(e.target.value)}
               placeholder={field.placeholder}
               rows={field.rows ?? 3}
               value={(value as string) ?? field.defaultValue ?? ""}
            />,
         );

      case "category-split":
         // This is handled by the CategorySplitConfiguration component
         // which is kept as a special case in node-configuration-panel.tsx
         return null;

      case "email-builder":
         return (
            <EmailBuilderField
               field={field}
               onChange={onChange}
               value={value as EmailTemplate | undefined}
            />
         );

      default:
         return null;
   }
}

function EmailBuilderField({
   field,
   value,
   onChange,
}: {
   field: ActionField;
   value: EmailTemplate | undefined;
   onChange: (value: unknown) => void;
}) {
   const [open, setOpen] = useState(false);
   const hasTemplate = value?.blocks && value.blocks.length > 0;

   return (
      <FieldGroup>
         <Field>
            <FieldLabel>
               {field.label}
               {field.required && <span className="text-destructive"> *</span>}
            </FieldLabel>
            <div className="flex items-center gap-2">
               <Button
                  className="w-full justify-start gap-2"
                  onClick={() => setOpen(true)}
                  type="button"
                  variant={hasTemplate ? "outline" : "default"}
               >
                  <Pencil className="size-4" />
                  {hasTemplate
                     ? `Template com ${value.blocks.length} bloco(s)`
                     : "Abrir Editor Visual"}
               </Button>
            </div>
            {field.helpText && (
               <FieldDescription>{field.helpText}</FieldDescription>
            )}
         </Field>
         <EmailBuilderDialog
            onChange={onChange}
            onOpenChange={setOpen}
            open={open}
            value={value}
         />
      </FieldGroup>
   );
}
