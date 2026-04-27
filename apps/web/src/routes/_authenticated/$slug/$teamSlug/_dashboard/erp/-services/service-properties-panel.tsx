import {
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupButton,
   InputGroupInput,
   InputGroupTextarea,
} from "@packages/ui/components/input-group";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
   AlignLeft,
   Briefcase,
   Calendar,
   Check,
   FolderTree,
   Info,
   Pencil,
   Tag as TagIcon,
   Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

type Service = Outputs["services"]["getById"];
type FieldKey = "name" | "description" | "categoryId" | "tagId";

const FIELD_WARNINGS: Record<FieldKey, string> = {
   name: "Alterar o nome será refletido em cobranças e assinaturas vinculadas.",
   description:
      "Alterar a descrição pode impactar a apresentação no portal do cliente.",
   categoryId:
      "Alterar a categoria afeta filtros e relatórios vinculados a este serviço.",
   tagId: "Alterar a tag pode impactar segmentações e relatórios.",
};

function SectionHeader({
   title,
   tooltip,
   children,
}: {
   title: string;
   tooltip?: string;
   children?: React.ReactNode;
}) {
   return (
      <ContextPanelHeader>
         <ContextPanelTitle>{title}</ContextPanelTitle>
         {tooltip && (
            <ContextPanelHeaderActions>
               <TooltipProvider>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Info className="size-3.5 text-muted-foreground" />
                     </TooltipTrigger>
                     <TooltipContent side="left">{tooltip}</TooltipContent>
                  </Tooltip>
               </TooltipProvider>
            </ContextPanelHeaderActions>
         )}
         {children}
      </ContextPanelHeader>
   );
}

function PropRow({
   icon: Icon,
   label,
   value,
   editNode,
   onEdit,
}: {
   icon: LucideIcon;
   label: string;
   value: React.ReactNode;
   editNode?: React.ReactNode;
   onEdit?: () => void;
}) {
   return (
      <Item size="sm" className="group/prop">
         <ItemMedia variant="icon">
            <Icon />
         </ItemMedia>
         <ItemContent>
            <ItemTitle className="text-xs font-normal text-muted-foreground">
               {label}
            </ItemTitle>
            <ItemDescription className="text-xs text-foreground">
               {editNode ?? value}
            </ItemDescription>
         </ItemContent>
         {!editNode && onEdit && (
            <ItemActions>
               <Button
                  aria-label={`Editar ${label}`}
                  className="size-6 opacity-0 transition-opacity group-hover/prop:opacity-100"
                  size="icon"
                  variant="ghost"
                  onClick={onEdit}
               >
                  <Pencil className="size-3" />
               </Button>
            </ItemActions>
         )}
      </Item>
   );
}

function InlineTextField({
   defaultValue,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const cancelledRef = useRef(false);
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <InputGroup>
               <InputGroupInput
                  autoFocus
                  aria-label="Editar campo"
                  className="text-xs"
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => {
                     if (!cancelledRef.current) form.handleSubmit();
                  }}
                  onKeyDown={(e) => {
                     if (e.key === "Enter") form.handleSubmit();
                     if (e.key === "Escape") {
                        cancelledRef.current = true;
                        onCancel();
                     }
                  }}
               />
               <InputGroupAddon align="inline-end">
                  <InputGroupButton
                     aria-label="Salvar"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => form.handleSubmit()}
                  >
                     <Check />
                  </InputGroupButton>
               </InputGroupAddon>
            </InputGroup>
         )}
      </form.Field>
   );
}

function InlineTextareaField({
   defaultValue,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   onCommit: (value: string) => void;
   onCancel: () => void;
}) {
   const cancelledRef = useRef(false);
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) => onCommit(value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <InputGroup>
               <InputGroupTextarea
                  autoFocus
                  aria-label="Editar descrição"
                  className="min-h-16 text-xs"
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={() => {
                     if (!cancelledRef.current) form.handleSubmit();
                  }}
                  onKeyDown={(e) => {
                     if (e.key === "Escape") {
                        cancelledRef.current = true;
                        onCancel();
                     }
                     if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                        form.handleSubmit();
                  }}
               />
               <InputGroupAddon align="inline-end">
                  <InputGroupButton
                     aria-label="Salvar"
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => form.handleSubmit()}
                  >
                     <Check />
                  </InputGroupButton>
               </InputGroupAddon>
            </InputGroup>
         )}
      </form.Field>
   );
}

function InlineSelectField({
   defaultValue,
   options,
   placeholder,
   onCommit,
   onCancel,
}: {
   defaultValue: string;
   options: { id: string; name: string; color?: string | null }[];
   placeholder: string;
   onCommit: (value: string | null) => void;
   onCancel: () => void;
}) {
   const form = useForm({
      defaultValues: { value: defaultValue },
      onSubmit: ({ value }) =>
         onCommit(value.value === "__none__" ? null : value.value),
   });

   return (
      <form.Field name="value">
         {(field) => (
            <Select
               defaultOpen
               value={field.state.value || "__none__"}
               onValueChange={(val) => {
                  field.handleChange(val);
                  form.handleSubmit();
               }}
               onOpenChange={(open) => {
                  if (!open && !field.state.value) onCancel();
               }}
            >
               <SelectTrigger className="h-6 text-xs">
                  <SelectValue placeholder={placeholder} />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="__none__">— Sem valor —</SelectItem>
                  {options.map((opt) => (
                     <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         )}
      </form.Field>
   );
}

export function ServicePropertiesPanel({ service }: { service: Service }) {
   const { openAlertDialog } = useAlertDialog();
   const [editingField, setEditingField] = useState<FieldKey | null>(null);

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: tagsResult } = useSuspenseQuery(
      orpc.tags.getAll.queryOptions({ input: {} }),
   );
   const tags = tagsResult.data;

   const updateMutation = useMutation(
      orpc.services.update.mutationOptions({
         onSuccess: () => {
            toast.success("Serviço atualizado.");
            setEditingField(null);
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   function cancelEdit() {
      setEditingField(null);
   }

   function commitTextEdit(field: "name" | "description", value: string) {
      const trimmed = value.trim() === "" ? null : value.trim();
      const doUpdate = () =>
         updateMutation.mutate({ id: service.id, [field]: trimmed });

      setEditingField(null);
      openAlertDialog({
         title: "Confirmar alteração",
         description: FIELD_WARNINGS[field],
         actionLabel: "Confirmar",
         cancelLabel: "Cancelar",
         onAction: doUpdate,
      });
   }

   function commitSelectEdit(
      field: "categoryId" | "tagId",
      value: string | null,
   ) {
      const doUpdate = () =>
         updateMutation.mutate({ id: service.id, [field]: value });

      setEditingField(null);
      openAlertDialog({
         title: "Confirmar alteração",
         description: FIELD_WARNINGS[field],
         actionLabel: "Confirmar",
         cancelLabel: "Cancelar",
         onAction: doUpdate,
      });
   }

   function toggleActive(next: boolean) {
      updateMutation.mutate({ id: service.id, isActive: next });
   }

   return (
      <div className="flex h-full flex-col gap-2 overflow-y-scroll px-2 py-4">
         <SectionHeader title="Dados">
            {!service.isActive && (
               <Badge className="text-xs" variant="outline">
                  Inativo
               </Badge>
            )}
         </SectionHeader>

         <ItemGroup>
            <PropRow
               icon={Briefcase}
               label="Nome"
               value={service.name}
               editNode={
                  editingField === "name" ? (
                     <InlineTextField
                        defaultValue={service.name}
                        onCommit={(v) => commitTextEdit("name", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("name")}
            />
            <PropRow
               icon={AlignLeft}
               label="Descrição"
               value={
                  service.description ?? (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "description" ? (
                     <InlineTextareaField
                        defaultValue={service.description ?? ""}
                        onCommit={(v) => commitTextEdit("description", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("description")}
            />
            <PropRow
               icon={FolderTree}
               label="Categoria"
               value={
                  service.category ? (
                     <Badge
                        style={
                           service.category.color
                              ? {
                                   borderColor: service.category.color,
                                   color: service.category.color,
                                }
                              : undefined
                        }
                        variant="outline"
                     >
                        {service.category.name}
                     </Badge>
                  ) : (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "categoryId" ? (
                     <InlineSelectField
                        defaultValue={service.categoryId ?? ""}
                        options={categories ?? []}
                        placeholder="Selecionar categoria"
                        onCommit={(v) => commitSelectEdit("categoryId", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("categoryId")}
            />
            <PropRow
               icon={TagIcon}
               label="Tag"
               value={
                  service.tag ? (
                     <Badge
                        style={
                           service.tag.color
                              ? {
                                   borderColor: service.tag.color,
                                   color: service.tag.color,
                                }
                              : undefined
                        }
                        variant="outline"
                     >
                        {service.tag.name}
                     </Badge>
                  ) : (
                     <span className="text-muted-foreground">—</span>
                  )
               }
               editNode={
                  editingField === "tagId" ? (
                     <InlineSelectField
                        defaultValue={service.tagId ?? ""}
                        options={tags ?? []}
                        placeholder="Selecionar tag"
                        onCommit={(v) => commitSelectEdit("tagId", v)}
                        onCancel={cancelEdit}
                     />
                  ) : undefined
               }
               onEdit={() => setEditingField("tagId")}
            />
            <PropRow
               icon={Zap}
               label="Ativo"
               value={
                  <Switch
                     checked={service.isActive}
                     onCheckedChange={toggleActive}
                  />
               }
            />
            <PropRow
               icon={Calendar}
               label="Criado em"
               value={dayjs(service.createdAt).format("DD/MM/YYYY")}
            />
         </ItemGroup>

         <SectionHeader
            title="Insights"
            tooltip="Métricas agregadas serão exibidas após a Fase 6."
         />
         <ItemGroup>
            <Item size="sm">
               <ItemContent>
                  <ItemDescription className="text-xs text-muted-foreground">
                     Métricas em construção
                  </ItemDescription>
               </ItemContent>
            </Item>
         </ItemGroup>
      </div>
   );
}
