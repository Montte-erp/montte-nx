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
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
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
import { Badge } from "@packages/ui/components/badge";
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
   X,
   Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
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
   "#ef4444", "#f97316", "#f59e0b", "#eab308",
   "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
   "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
   "#d946ef", "#ec4899", "#f43f5e", "#78716c",
];

const ICON_OPTIONS = CATEGORY_ICONS.map(({ name, label }) => ({ value: name, label }));
const ICON_MAP = Object.fromEntries(CATEGORY_ICONS.map(({ name, Icon }) => [name, Icon]));

function IconOption({ value, label }: { value: string; label: string }) {
   const Icon = ICON_MAP[value];
   return (
      <span className="flex items-center gap-2">
         {Icon && <Icon className="size-4 shrink-0" />}
         {label}
      </span>
   );
}

interface CategoryFormProps {
   mode: "create" | "edit";
   category?: {
      id: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      keywords?: string[] | null;
      type?: string | null;
      notes?: string | null;
   };
   onSuccess: () => void;
}

export function CategoryForm({ mode, category, onSuccess }: CategoryFormProps) {
   const isCreate = mode === "create";
   const [keywordInput, setKeywordInput] = useState("");

   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => {
            toast.success("Categoria criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar categoria.");
         },
      }),
   );

   const updateMutation = useMutation(
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
            createMutation.mutate(payload);
         } else if (category) {
            updateMutation.mutate({ id: category.id, ...payload });
         }
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

   const addKeyword = useCallback(
      (keywords: string[], push: (val: string) => void) => {
         const trimmed = keywordInput.trim().toLowerCase();
         if (trimmed && !keywords.includes(trimmed)) {
            push(trimmed);
         }
         setKeywordInput("");
      },
      [keywordInput],
   );

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>{isCreate ? "Nova Categoria" : "Editar Categoria"}</CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Preencha os dados da nova categoria."
                  : "Atualize os dados da categoria."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome *</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Ex: Alimentação, Transporte"
                              value={field.state.value}
                           />
                           {isInvalid && <FieldError errors={field.state.meta.errors} />}
                        </Field>
                     );
                  }}
               </form.Field>

               <form.Field name="type">
                  {(field) => (
                     <Field>
                        <FieldLabel>Tipo</FieldLabel>
                        <Select
                           onValueChange={(v) => field.handleChange(v as "income" | "expense")}
                           value={field.state.value}
                        >
                           <SelectTrigger>
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="expense">Despesa</SelectItem>
                              <SelectItem value="income">Receita</SelectItem>
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
                              onValueChange={(v) => field.handleChange(v || "")}
                              options={ICON_OPTIONS}
                              placeholder="Selecionar ícone..."
                              renderOption={(opt) => <IconOption label={opt.label} value={opt.value} />}
                              renderSelected={(opt) => <IconOption label={opt.label} value={opt.value} />}
                              searchPlaceholder="Buscar ícone..."
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="color">
                     {(field) => (
                        <Field>
                           <FieldLabel>Cor</FieldLabel>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    className="w-full flex gap-2 justify-start"
                                    type="button"
                                    variant="outline"
                                 >
                                    <div
                                       className="w-4 h-4 rounded border border-border shrink-0"
                                       style={{ backgroundColor: field.state.value }}
                                    />
                                    {field.state.value}
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64 rounded-md border bg-background">
                                 <div className="flex flex-col gap-4">
                                    <div className="grid grid-cols-8 gap-2">
                                       {PRESET_COLORS.map((color) => (
                                          <button
                                             className="w-6 h-6 rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                             key={color}
                                             onClick={() => field.handleChange(color)}
                                             style={{ backgroundColor: color }}
                                             type="button"
                                          />
                                       ))}
                                    </div>
                                    <ColorPicker
                                       className="flex flex-col gap-4"
                                       onChange={(rgba) => {
                                          if (Array.isArray(rgba)) {
                                             field.handleChange(
                                                Color.rgb(rgba[0], rgba[1], rgba[2]).hex(),
                                             );
                                          }
                                       }}
                                       value={field.state.value || "#000000"}
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
                        </Field>
                     )}
                  </form.Field>
               </div>

               <form.Field name="keywords" mode="array">
                  {(field) => (
                     <Field>
                        <FieldLabel>Palavras-chave</FieldLabel>
                        <div className="flex flex-col gap-2">
                           <Input
                              onKeyDown={(e) => {
                                 if (e.key === "Enter") {
                                    e.preventDefault();
                                    addKeyword(field.state.value, field.pushValue);
                                 }
                              }}
                              onChange={(e) => setKeywordInput(e.target.value)}
                              placeholder="Digite e pressione Enter para adicionar..."
                              value={keywordInput}
                           />
                           {field.state.value.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                 {field.state.value.map((kw, i) => (
                                    <Badge className="gap-1 pr-1" key={`kw-${i + 1}`} variant="secondary">
                                       {kw}
                                       <button
                                          className="rounded-full hover:text-foreground"
                                          onClick={() => field.removeValue(i)}
                                          type="button"
                                       >
                                          <X className="size-3" />
                                       </button>
                                    </Badge>
                                 ))}
                              </div>
                           )}
                        </div>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe selector={(s) => s}>
               {(state) => (
                  <Button disabled={!state.canSubmit || state.isSubmitting || isPending} type="submit">
                     {(state.isSubmitting || isPending) && <Spinner className="size-4 mr-2" />}
                     Salvar
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
