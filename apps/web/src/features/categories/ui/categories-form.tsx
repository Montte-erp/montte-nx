import { Button } from "@packages/ui/components/button";
import {
   ColorPicker,
   ColorPickerAlpha,
   ColorPickerEyeDropper,
   ColorPickerFormat,
   ColorPickerHue,
   ColorPickerOutput,
   ColorPickerSelection,
} from "@packages/ui/components/color-picker";
import { Combobox } from "@packages/ui/components/combobox";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Textarea } from "@packages/ui/components/textarea";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import {
   Baby,
   BookOpen,
   Briefcase,
   Car,
   Coffee,
   CreditCard,
   Dumbbell,
   Fuel,
   Gift,
   Heart,
   Home,
   type LucideIcon,
   Music,
   Package,
   Plane,
   ShoppingCart,
   Smartphone,
   Utensils,
   Wallet,
   Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

const CATEGORY_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
   { name: "wallet", label: "Carteira", Icon: Wallet },
   { name: "credit-card", label: "Cartão de Crédito", Icon: CreditCard },
   { name: "home", label: "Casa", Icon: Home },
   { name: "car", label: "Carro", Icon: Car },
   { name: "shopping-cart", label: "Compras", Icon: ShoppingCart },
   { name: "utensils", label: "Alimentação", Icon: Utensils },
   { name: "plane", label: "Viagem", Icon: Plane },
   { name: "heart", label: "Saúde", Icon: Heart },
   { name: "book-open", label: "Educação", Icon: BookOpen },
   { name: "briefcase", label: "Trabalho", Icon: Briefcase },
   { name: "package", label: "Encomenda", Icon: Package },
   { name: "music", label: "Música", Icon: Music },
   { name: "coffee", label: "Café", Icon: Coffee },
   { name: "smartphone", label: "Celular", Icon: Smartphone },
   { name: "dumbbell", label: "Academia", Icon: Dumbbell },
   { name: "baby", label: "Bebê", Icon: Baby },
   { name: "gift", label: "Presente", Icon: Gift },
   { name: "zap", label: "Energia", Icon: Zap },
   { name: "fuel", label: "Combustível", Icon: Fuel },
];

const PRESET_COLORS = [
   "#ef4444",
   "#f97316",
   "#f59e0b",
   "#eab308",
   "#84cc16",
   "#22c55e",
   "#14b8a6",
   "#06b6d4",
   "#3b82f6",
   "#6366f1",
   "#8b5cf6",
   "#a855f7",
   "#d946ef",
   "#ec4899",
   "#f43f5e",
   "#78716c",
];

const ICON_OPTIONS = CATEGORY_ICONS.map(({ name, label }) => ({
   value: name,
   label,
}));

const ICON_MAP = Object.fromEntries(
   CATEGORY_ICONS.map(({ name, Icon }) => [name, Icon]),
);

function IconOption({ value, label }: { value: string; label: string }) {
   const Icon = ICON_MAP[value];
   return (
      <span className="flex items-center gap-2">
         {Icon && <Icon className="size-4 shrink-0" />}
         {label}
      </span>
   );
}

type AccountType = "totalizadora" | "subconta";

interface CategoryFormProps {
   mode: "create" | "edit";
   accountType?: AccountType;
   category?: {
      id: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      keywords?: string[] | null;
      type?: string | null;
      categoryId?: string | null;
      isReturn?: boolean | null;
      notes?: string | null;
   };
   onSuccess: () => void;
}

export function CategoryForm({
   mode,
   accountType: initialAccountType,
   category,
   onSuccess,
}: CategoryFormProps) {
   const isCreate = mode === "create";
   const [accountType, setAccountType] = useState<AccountType>(
      initialAccountType ?? "totalizadora",
   );

   const createCategoryMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => {
            toast.success("Conta totalizadora criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar conta.");
         },
      }),
   );

   const updateCategoryMutation = useMutation(
      orpc.categories.update.mutationOptions({
         onSuccess: () => {
            toast.success("Categoria atualizada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar categoria.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         color: category?.color ?? "#6366f1",
         icon: category?.icon ?? "",
         keywords: (category?.keywords ?? []) as string[],
         name: category?.name ?? "",
         notes: category?.notes ?? "",
         type: (category?.type ?? "expense") as "income" | "expense",
      },
      onSubmit: async ({ value }) => {
         const payload = {
            color: value.color || null,
            icon: value.icon || null,
            keywords: value.keywords.length > 0 ? value.keywords : null,
            name: value.name.trim(),
            notes: value.notes || null,
            type: value.type,
         };
         if (isCreate) {
            createCategoryMutation.mutate(payload);
         } else if (category) {
            updateCategoryMutation.mutate({ id: category.id, ...payload });
         }
      },
   });

   const isPending =
      createCategoryMutation.isPending || updateCategoryMutation.isPending;

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <DialogStackContent index={0}>
            <DialogStackHeader>
               <DialogStackTitle>
                  {isCreate ? "Nova Categoria" : "Editar Categoria"}
               </DialogStackTitle>
               <DialogStackDescription>
                  Contas totalizadoras somam subcontas. Os lançamentos só
                  consideram subcontas.
               </DialogStackDescription>
            </DialogStackHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
               <FieldGroup>
                  <Field>
                     <FieldLabel>Tipo de Conta *</FieldLabel>
                     <Select
                        disabled={!isCreate}
                        onValueChange={(v) => setAccountType(v as AccountType)}
                        value={accountType}
                     >
                        <SelectTrigger>
                           <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="totalizadora">
                              Totalizadora
                           </SelectItem>
                           <SelectItem value="subconta">Subconta</SelectItem>
                        </SelectContent>
                     </Select>
                  </Field>

                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Nome *</FieldLabel>
                              <Input
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Ex: Alimentação, Transporte"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>

                  <>
                     <form.Field name="type">
                        {(field) => (
                           <Field>
                              <FieldLabel>Tipo</FieldLabel>
                              <Select
                                 onValueChange={(v) =>
                                    field.handleChange(
                                       v as "income" | "expense",
                                    )
                                 }
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="expense">
                                       Despesa
                                    </SelectItem>
                                    <SelectItem value="income">
                                       Receita
                                    </SelectItem>
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>

                     <div className="grid grid-cols-[1fr_auto] gap-4">
                        <form.Field name="icon">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Ícone</FieldLabel>
                                 <Combobox
                                    className="w-full"
                                    emptyMessage="Ícone não encontrado."
                                    onValueChange={(v) =>
                                       field.handleChange(v || "")
                                    }
                                    options={ICON_OPTIONS}
                                    placeholder="Selecionar ícone..."
                                    renderOption={(opt) => (
                                       <IconOption
                                          label={opt.label}
                                          value={opt.value}
                                       />
                                    )}
                                    renderSelected={(opt) => (
                                       <IconOption
                                          label={opt.label}
                                          value={opt.value}
                                       />
                                    )}
                                    searchPlaceholder="Buscar ícone..."
                                    value={field.state.value}
                                 />
                              </Field>
                           )}
                        </form.Field>

                        <form.Field name="color">
                           {(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 !field.state.meta.isValid;
                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel>Cor</FieldLabel>
                                    <Popover>
                                       <PopoverTrigger asChild>
                                          <Button
                                             aria-invalid={
                                                isInvalid || undefined
                                             }
                                             className="w-full flex gap-2 justify-start"
                                             type="button"
                                             variant="outline"
                                          >
                                             <div
                                                className="w-4 h-4 rounded border border-border shrink-0"
                                                style={{
                                                   backgroundColor:
                                                      field.state.value,
                                                }}
                                             />
                                             {field.state.value}
                                          </Button>
                                       </PopoverTrigger>
                                       <PopoverContent
                                          align="start"
                                          className="w-64 rounded-md border bg-background"
                                       >
                                          <div className="flex flex-col gap-4">
                                             <div className="grid grid-cols-8 gap-2">
                                                {PRESET_COLORS.map((color) => (
                                                   <button
                                                      className="w-6 h-6 rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                      key={color}
                                                      onClick={() =>
                                                         field.handleChange(
                                                            color,
                                                         )
                                                      }
                                                      style={{
                                                         backgroundColor: color,
                                                      }}
                                                      type="button"
                                                   />
                                                ))}
                                             </div>
                                             <ColorPicker
                                                className="flex flex-col gap-4"
                                                onChange={(rgba) => {
                                                   if (Array.isArray(rgba)) {
                                                      field.handleChange(
                                                         Color.rgb(
                                                            rgba[0],
                                                            rgba[1],
                                                            rgba[2],
                                                         ).hex(),
                                                      );
                                                   }
                                                }}
                                                value={
                                                   field.state.value ||
                                                   "#000000"
                                                }
                                             >
                                                <div className="h-24">
                                                   <ColorPickerSelection />
                                                </div>
                                                <div className="flex items-center gap-4">
                                                   <ColorPickerEyeDropper />
                                                   <div className="grid w-full gap-2">
                                                      <ColorPickerHue />
                                                      <ColorPickerAlpha />
                                                   </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                   <ColorPickerOutput />
                                                   <ColorPickerFormat />
                                                </div>
                                             </ColorPicker>
                                          </div>
                                       </PopoverContent>
                                    </Popover>
                                    {isInvalid && (
                                       <FieldError
                                          errors={field.state.meta.errors}
                                       />
                                    )}
                                 </Field>
                              );
                           }}
                        </form.Field>
                     </div>
                  </>

                  <form.Field name="notes">
                     {(field) => (
                        <Field>
                           <FieldLabel>Outras informações</FieldLabel>
                           <Textarea
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder=""
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </div>

            <div className="border-t px-4 py-4">
               <form.Subscribe selector={(state) => state}>
                  {(state) => (
                     <Button
                        disabled={
                           !state.canSubmit || state.isSubmitting || isPending
                        }
                        type="submit"
                     >
                        {(state.isSubmitting || isPending) && (
                           <Spinner className="size-4 mr-2" />
                        )}
                        Salvar
                     </Button>
                  )}
               </form.Subscribe>
            </div>
         </DialogStackContent>
      </form>
   );
}
