import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { SidebarTrigger } from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { useStore } from "@tanstack/react-store";
import { Check, MoreVertical, Pencil, X } from "lucide-react";
import {
   type ReactNode,
   useCallback,
   useEffect,
   useRef,
   useState,
} from "react";
import { ContextPanelHeaderActions } from "@/features/context-panel/context-panel-header-actions";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { contextPanelStore } from "@/features/context-panel/context-panel-store";
import { usePageActions } from "@/features/context-panel/use-context-panel";

export interface PageHeaderProps {
   title: string;
   description?: ReactNode;
   editable?: boolean;
   onTitleChange?: (value: string) => void;
   onDescriptionChange?: (value: string) => void;
   titlePlaceholder?: string;
   descriptionPlaceholder?: string;
   actions?: ReactNode;
   /** Structured actions that move into the context panel info tab when the panel is open. */
   panelActions?: PanelAction[];
   className?: string;
}

function InlineEditableText({
   value,
   placeholder,
   onSave,
   className,
   textClassName,
}: {
   value: string;
   placeholder?: string;
   onSave: (value: string) => void;
   className?: string;
   textClassName?: string;
}) {
   const [isEditing, setIsEditing] = useState(false);
   const [draft, setDraft] = useState(value);
   const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      if (isEditing) {
         inputRef.current?.focus();
         inputRef.current?.select();
      }
   }, [isEditing]);

   const startEditing = useCallback(() => {
      setDraft(value);
      setIsEditing(true);
   }, [value]);

   const commit = useCallback(() => {
      setIsEditing(false);
      const trimmed = draft.trim();
      if (trimmed !== value) {
         onSave(trimmed);
      }
   }, [draft, value, onSave]);

   const discard = useCallback(() => {
      setDraft(value);
      setIsEditing(false);
   }, [value]);

   const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
         if (e.key === "Enter") {
            e.preventDefault();
            commit();
         } else if (e.key === "Escape") {
            discard();
         }
      },
      [commit, discard],
   );

   if (isEditing) {
      return (
         <div className={cn("flex items-center gap-1.5", textClassName)}>
            <Input
               className="h-auto text-[length:inherit] font-[inherit] leading-[inherit]"
               onBlur={commit}
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder={placeholder}
               ref={inputRef}
               value={draft}
            />
            <Button
               onClick={commit}
               tooltip="Salvar"
               type="button"
               variant="outline"
            >
               <Check />
            </Button>
            <Button
               onClick={discard}
               onMouseDown={(e) => e.preventDefault()}
               tooltip="Cancelar"
               type="button"
               variant="outline"
            >
               <X />
            </Button>
         </div>
      );
   }

   return (
      <div className={cn("flex items-center gap-1.5", className)}>
         <span
            className={cn(
               "truncate",
               !value && "text-muted-foreground",
               textClassName,
            )}
         >
            {value || placeholder}
         </span>
         <Button
            onClick={startEditing}
            tooltip="Editar"
            type="button"
            variant="outline"
         >
            <Pencil />
         </Button>
      </div>
   );
}

const TITLE_CLASS = "text-2xl font-semibold font-serif leading-tight";
const DESCRIPTION_CLASS = "text-base text-muted-foreground font-sans";

export function PageHeader({
   title,
   description,
   editable = false,
   onTitleChange,
   onDescriptionChange,
   titlePlaceholder = "Título",
   descriptionPlaceholder = "Adicionar descrição...",
   actions,
   panelActions,
   className,
}: PageHeaderProps) {
   // Selector — only re-renders when isOpen changes, not on pageActions store updates
   const isOpen = useStore(contextPanelStore, (s) => s.isOpen);
   // Register panel actions in the store so InfoContent can display them
   usePageActions(panelActions ?? null);
   const hasEditableDescription = editable && onDescriptionChange != null;
   const showDescription = description != null || hasEditableDescription;

   const hasMobileOverflow = !isOpen && (panelActions?.length ?? 0) > 0;

   return (
      <header
         className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
            className,
         )}
      >
         {/* Mobile top bar: hamburger | title | actions */}
         <div className="flex sm:hidden items-center gap-2">
            <SidebarTrigger />
            <h1 className={cn(TITLE_CLASS, "flex-1 truncate text-lg")}>
               {title}
            </h1>
            {actions}
            {!isOpen && <ContextPanelHeaderActions />}
            {hasMobileOverflow && (
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="outline">
                        <MoreVertical className="size-4" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     {panelActions?.map((action) => (
                        <DropdownMenuItem
                           key={action.label}
                           onClick={action.onClick}
                        >
                           <action.icon className="size-4" />
                           {action.label}
                        </DropdownMenuItem>
                     ))}
                  </DropdownMenuContent>
               </DropdownMenu>
            )}
         </div>

         {/* Desktop: title + description */}
         <div className="hidden sm:flex items-start min-w-0 flex-1 max-w-2xl">
            <div
               className={cn(
                  "flex flex-col min-w-0",
                  showDescription && "gap-1.5",
               )}
            >
               {editable && onTitleChange ? (
                  <InlineEditableText
                     onSave={onTitleChange}
                     placeholder={titlePlaceholder}
                     textClassName={TITLE_CLASS}
                     value={title}
                  />
               ) : (
                  <h1 className={TITLE_CLASS}>{title}</h1>
               )}
               {hasEditableDescription ? (
                  <InlineEditableText
                     onSave={onDescriptionChange}
                     placeholder={descriptionPlaceholder}
                     textClassName={DESCRIPTION_CLASS}
                     value={typeof description === "string" ? description : ""}
                  />
               ) : description != null ? (
                  <p className={cn(DESCRIPTION_CLASS, "leading-relaxed")}>
                     {description}
                  </p>
               ) : null}
            </div>
         </div>

         {/* Desktop: actions */}
         <div className="hidden sm:flex items-center gap-2 shrink-0">
            {!isOpen &&
               panelActions?.map((action) => (
                  <Button
                     key={action.label}
                     onClick={action.onClick}
                     tooltip={action.label}
                     type="button"
                     variant="outline"
                  >
                     <action.icon className="size-4" />
                  </Button>
               ))}
            {actions}
            {!isOpen && <ContextPanelHeaderActions />}
         </div>
      </header>
   );
}
