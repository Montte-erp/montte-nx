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
   Shuffle,
   ShoppingCart,
   Smartphone,
   Utensils,
   Wallet,
   X,
   Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
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

function randomIcon() {
   return CATEGORY_ICONS[Math.floor(Math.random() * CATEGORY_ICONS.length)]
      .name;
}

function randomColor() {
   return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

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
      type?: string | null;
      description?: string | null;
   };
   onSuccess: () => void;
}

export function CategoryForm({ mode, category, onSuccess }: CategoryFormProps) {
   const isCreate = mode === "create";
   const [pendingSubcategories, setPendingSubcategories] = useState<string[]>(
      [],
   );
   const [subInput, setSubInput] = useState("");
   const subInputRef = useRef<HTMLInputElement>(null);

   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
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
         color: category?.color ?? (isCreate ? randomColor() : "#6366f1"),
         icon: category?.icon ?? (isCreate ? randomIcon() : ""),
         name: category?.name ?? "",
         type: (category?.type ?? "expense") as "income" | "expense",
         description: category?.description ?? "",
      },
      onSubmit: async ({ value }) => {
         const payload = {
            color: value.color || null,
            icon: value.icon || null,
            name: value.name.trim(),
            type: value.type,
            description: value.description?.trim() || null,
         };

         if (isCreate) {
            const created = await createMutation.mutateAsync(payload);
            if (pendingSubcategories.length > 0) {
               const results = await Promise.allSettled(
                  pendingSubcategories.map((name) =>
                     createMutation.mutateAsync({
                        name,
                        parentId: created.id,
                        type: value.type,
                     }),
                  ),
               );
               const failed = results.filter((r) => r.status === "rejected");
               if (failed.length > 0) {
                  toast.error(
                     `${failed.length} subcategoria(s) não puderam ser criadas.`,
                  );
               }
            }
            toast.success("Categoria criada com sucesso.");
            onSuccess();
         } else if (category) {
            updateMutation.mutate({ id: category.id, ...payload });
         }
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

   const addSubcategory = useCallback(
      (name: string) => {
         const trimmed = name.trim();
         if (!trimmed || pendingSubcategories.includes(trimmed)) return;
         setPendingSubcategories((prev) => [...prev, trimmed]);
         setSubInput("");
      },
      [pendingSubcategories],
   );

   const removeSubcategory = useCallback((index: number) => {
      setPendingSubcategories((prev) => prev.filter((_, i) => i !== index));
   }, []);

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Nova Categoria" : "Editar Categoria"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Preencha os dados da nova categoria."
                  : "Atualize os dados da categoria."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               <div className="grid grid-cols-2 gap-4">
                  <form.Field
                     name="name"
                     validators={{
                        onChange: ({ value }) =>
                           !value.trim() ? "Nome é obrigatório" : undefined,
                        onSubmit: ({ value }) =>
                           !value.trim() ? "Nome é obrigatório" : undefined,
                     }}
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Nome *
                              </FieldLabel>
                              <Input
                                 autoFocus
                                 id={field.name}
                                 name={field.name}
                                 aria-invalid={isInvalid}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Ex: Alimentação"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  />

                  <form.Field
                     name="type"
                     children={(field) => (
                        <Field>
                           <FieldLabel>Tipo</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 field.handleChange(v as "income" | "expense")
                              }
                              onOpenChange={(open) => {
                                 if (!open) field.handleBlur();
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="expense">
                                    Despesa
                                 </SelectItem>
                                 <SelectItem value="income">Receita</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  />
               </div>

               <form.Field
                  name="description"
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                        <Textarea
                           id={field.name}
                           name={field.name}
                           aria-invalid={false}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Descreva quando usar esta categoria..."
                           rows={2}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               />

               <form.Subscribe
                  selector={(s) => ({
                     icon: s.values.icon,
                     color: s.values.color,
                     name: s.values.name,
                  })}
               >
                  {({ icon, color, name }) => {
                     const PreviewIcon = icon ? ICON_MAP[icon] : null;
                     return (
                        <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                           <div
                              className="size-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{ backgroundColor: color }}
                           >
                              {PreviewIcon && (
                                 <PreviewIcon className="size-6 text-white" />
                              )}
                           </div>
                           <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <span className="text-sm font-medium truncate">
                                 {name || "Nova categoria"}
                              </span>
                              <span className="text-xs text-muted-foreground truncate">
                                 {color}
                              </span>
                           </div>
                           <Button
                              aria-label="Aleatorizar ícone e cor"
                              onClick={() => {
                                 form.setFieldValue("icon", randomIcon());
                                 form.setFieldValue("color", randomColor());
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                           >
                              <Shuffle
                                 aria-hidden="true"
                                 className="size-3.5"
                              />
                           </Button>
                        </div>
                     );
                  }}
               </form.Subscribe>

               <div className="grid grid-cols-2 gap-4">
                  <form.Field
                     name="color"
                     children={(field) => (
                        <Field>
                           <FieldLabel>Cor</FieldLabel>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    className="w-full justify-start gap-2"
                                    type="button"
                                    variant="outline"
                                 >
                                    <span
                                       className="size-4 rounded shrink-0"
                                       style={{
                                          backgroundColor: field.state.value,
                                       }}
                                    />
                                    <span className="truncate text-xs font-mono">
                                       {field.state.value}
                                    </span>
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-64">
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
                                    value={field.state.value || "#000000"}
                                 >
                                    <div className="h-32 rounded-md overflow-hidden">
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
                              </PopoverContent>
                           </Popover>
                        </Field>
                     )}
                  />

                  <form.Field
                     name="icon"
                     children={(field) => (
                        <Field>
                           <FieldLabel>Ícone</FieldLabel>
                           <Combobox
                              className="w-full"
                              emptyMessage="Ícone não encontrado."
                              onValueChange={(v) => field.handleChange(v || "")}
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
                  />
               </div>

               {isCreate && (
                  <Field>
                     <FieldLabel>Subcategorias</FieldLabel>
                     <div
                        className="flex flex-wrap gap-2 min-h-10 rounded-md border bg-background px-3 py-2 cursor-text"
                        onClick={() => subInputRef.current?.focus()}
                     >
                        {pendingSubcategories.map((name, i) => (
                           <span
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground"
                              key={`sub-${i + 1}`}
                           >
                              {name}
                              <button
                                 aria-label={`Remover subcategoria ${name}`}
                                 className="text-secondary-foreground/50 hover:text-secondary-foreground transition-colors"
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    removeSubcategory(i);
                                 }}
                                 type="button"
                              >
                                 <X aria-hidden="true" className="size-3" />
                              </button>
                           </span>
                        ))}
                        <input
                           aria-label="Adicionar subcategoria"
                           className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                           onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                 e.preventDefault();
                                 addSubcategory(subInput);
                              }
                              if (
                                 e.key === "Backspace" &&
                                 !subInput &&
                                 pendingSubcategories.length > 0
                              ) {
                                 removeSubcategory(
                                    pendingSubcategories.length - 1,
                                 );
                              }
                           }}
                           onChange={(e) => setSubInput(e.target.value)}
                           placeholder={
                              pendingSubcategories.length === 0
                                 ? "Digite e pressione Enter..."
                                 : ""
                           }
                           ref={subInputRef}
                           value={subInput}
                        />
                     </div>
                  </Field>
               )}
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe
               selector={(s) => ({
                  canSubmit: s.canSubmit,
                  isSubmitting: s.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={!canSubmit || isSubmitting || isPending}
                     type="submit"
                  >
                     {(isSubmitting || isPending) && (
                        <Spinner className="size-4" />
                     )}
                     Salvar
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
