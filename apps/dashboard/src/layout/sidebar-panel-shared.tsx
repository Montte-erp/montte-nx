import { Button } from "@packages/ui/components/button";
import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarHeader,
   SidebarInput,
   SidebarMenu,
   SidebarMenuAction,
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarMenuSkeleton,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import {
   ArrowDownAZ,
   ArrowUpAZ,
   CalendarClock,
   CalendarPlus,
   ChevronDown,
   ChevronRight,
   Copy,
   ExternalLink,
   MoreHorizontal,
   PanelTop,
   Plus,
   Search,
   SortAsc,
   X,
} from "lucide-react";
import { toast } from "sonner";
import type { SortDirection, SortOption } from "./hooks/use-submenu-data";

// ============================================
// Helper Functions
// ============================================

export function getRelativeTime(date: Date): string {
   return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR,
   });
}

// ============================================
// Sort Options
// ============================================

export const SORT_OPTIONS: Array<{
   value: SortOption;
   label: string;
   icon: typeof ArrowDownAZ;
}> = [
   { value: "name", label: "Nome", icon: ArrowDownAZ },
   { value: "date_created", label: "Data de criação", icon: CalendarPlus },
   { value: "date_updated", label: "Última atualização", icon: CalendarClock },
];

// ============================================
// Collapsible Section
// ============================================

export type CollapsibleSectionProps = {
   title: string;
   count?: number;
   isExpanded: boolean;
   onToggle: () => void;
   children: React.ReactNode;
   action?: React.ReactNode;
};

export function CollapsibleSection({
   title,
   count,
   isExpanded,
   onToggle,
   children,
   action,
}: CollapsibleSectionProps) {
   return (
      <Collapsible onOpenChange={onToggle} open={isExpanded}>
         <SidebarGroup className="py-0">
            <div className="flex items-center justify-between px-2 py-1.5">
               <CollapsibleTrigger className="flex flex-1 items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                  {isExpanded ? (
                     <ChevronDown className="size-3" />
                  ) : (
                     <ChevronRight className="size-3" />
                  )}
                  <span>{title}</span>
                  {count !== undefined && count > 0 && (
                     <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-normal normal-case">
                        {count}
                     </span>
                  )}
               </CollapsibleTrigger>
               {action && (
                  <div onClick={(e) => e.stopPropagation()}>{action}</div>
               )}
            </div>
            <CollapsibleContent>
               <SidebarGroupContent>
                  <SidebarMenu>{children}</SidebarMenu>
               </SidebarGroupContent>
            </CollapsibleContent>
         </SidebarGroup>
      </Collapsible>
   );
}

// ============================================
// Item Row
// ============================================

export type ItemRowProps = {
   id: string;
   name: string;
   url: string;
   icon: LucideIcon;
   iconColor?: string;
   timestamp?: Date;
   isActive: boolean;
   onClick: () => void;
   badge?: React.ReactNode;
   onOpenInDashboardTab: () => void;
};

export function ItemRow({
   name,
   url,
   icon: Icon,
   iconColor,
   timestamp,
   isActive,
   onClick,
   badge,
   onOpenInDashboardTab,
}: ItemRowProps) {
   const handleOpenBrowserTab = () => {
      window.open(url, "_blank");
   };

   const handleCopyLink = async () => {
      try {
         const fullUrl = `${window.location.origin}${url}`;
         await navigator.clipboard.writeText(fullUrl);
         toast.success("Link copiado");
      } catch {
         toast.error("Falha ao copiar o link");
      }
   };

   return (
      <SidebarMenuItem>
         <SidebarMenuButton
            asChild
            className={cn(isActive && "bg-primary/10 text-primary")}
            isActive={isActive}
         >
            <Link onClick={onClick} to={url}>
               <Icon
                  className="size-4 shrink-0"
                  style={iconColor ? { color: iconColor } : undefined}
               />
               <span className="flex-1 truncate">{name}</span>
               {badge}
               {timestamp && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                     {getRelativeTime(timestamp)}
                  </span>
               )}
            </Link>
         </SidebarMenuButton>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <SidebarMenuAction showOnHover>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Mais opções</span>
               </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent
               align="start"
               className="min-w-48"
               side="right"
            >
               <DropdownMenuItem onClick={onOpenInDashboardTab}>
                  <PanelTop className="size-4 mr-2" />
                  Abrir em nova aba
               </DropdownMenuItem>
               <DropdownMenuItem onClick={handleOpenBrowserTab}>
                  <ExternalLink className="size-4 mr-2" />
                  Abrir em nova janela
               </DropdownMenuItem>
               <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="size-4 mr-2" />
                  Copiar link
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </SidebarMenuItem>
   );
}

// ============================================
// Search Header
// ============================================

export type SearchHeaderProps = {
   search: string;
   onSearchChange: (search: string) => void;
   sortBy: SortOption;
   sortDirection: SortDirection;
   onSortChange: (sortBy: SortOption, direction?: SortDirection) => void;
   placeholder?: string;
};

export function SearchHeader({
   search,
   onSearchChange,
   sortBy,
   sortDirection,
   onSortChange,
   placeholder = "Buscar...",
}: SearchHeaderProps) {
   return (
      <div className="h-14 flex items-center gap-2 px-3 border-b border-sidebar-border">
         <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <SidebarInput
               className="pl-8"
               onChange={(e) => onSearchChange(e.target.value)}
               placeholder={placeholder}
               type="text"
               value={search}
            />
         </div>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button className="size-8 shrink-0" size="icon" variant="ghost">
                  <SortAsc className="size-4" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
               {SORT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = sortBy === option.value;
                  return (
                     <DropdownMenuItem
                        className={cn(isSelected && "bg-accent")}
                        key={option.value}
                        onClick={() => onSortChange(option.value)}
                     >
                        <Icon className="size-4 mr-2" />
                        {option.label}
                        {isSelected && (
                           <span className="ml-auto text-xs text-muted-foreground">
                              {sortDirection === "asc" ? "A-Z" : "Z-A"}
                           </span>
                        )}
                     </DropdownMenuItem>
                  );
               })}
               <DropdownMenuItem
                  onClick={() =>
                     onSortChange(
                        sortBy,
                        sortDirection === "asc" ? "desc" : "asc",
                     )
                  }
               >
                  {sortDirection === "asc" ? (
                     <ArrowDownAZ className="size-4 mr-2" />
                  ) : (
                     <ArrowUpAZ className="size-4 mr-2" />
                  )}
                  {sortDirection === "asc"
                     ? "Ordem decrescente"
                     : "Ordem crescente"}
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}

// ============================================
// Loading Skeleton
// ============================================

export function LoadingSkeleton() {
   return (
      <SidebarMenu className="px-2">
         {Array.from({ length: 5 }).map((_, i) => (
            <SidebarMenuSkeleton key={`skeleton-${i + 1}`} showIcon />
         ))}
      </SidebarMenu>
   );
}

// ============================================
// Empty State
// ============================================

export type EmptyStateProps = {
   search: string;
   emptyMessage?: string;
};

export function EmptyState({
   search,
   emptyMessage = "Nenhum item encontrado",
}: EmptyStateProps) {
   return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
         <Search className="size-8 text-muted-foreground mb-2" />
         <p className="text-sm text-muted-foreground">
            {search
               ? `Nenhum resultado encontrado para "${search}"`
               : emptyMessage}
         </p>
      </div>
   );
}

// ============================================
// Create Action Button
// ============================================

export type CreateActionProps = {
   icon: LucideIcon;
   label: string;
   onClick: () => void;
};

export function CreateAction({
   icon: Icon,
   label,
   onClick,
}: CreateActionProps) {
   return (
      <button
         className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
         onClick={onClick}
         type="button"
      >
         <Icon className="size-4" />
         <span>{label}</span>
      </button>
   );
}

// ============================================
// Panel Header
// ============================================

export type CreateOption = {
   icon: LucideIcon;
   label: string;
   onClick: () => void;
};

export type PanelHeaderProps = {
   title: string;
   icon: LucideIcon;
   createOptions: CreateOption[];
};

export function PanelHeader({
   title,
   icon: Icon,
   createOptions,
}: PanelHeaderProps) {
   return (
      <SidebarHeader className="h-12 flex-row items-center justify-between border-b border-sidebar-border p-3">
         <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
         </div>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button className="size-7" size="icon" variant="ghost">
                  <Plus className="size-4" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
               <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  Criar novo
               </DropdownMenuLabel>
               <DropdownMenuSeparator />
               {createOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                     <DropdownMenuItem
                        key={option.label}
                        onClick={option.onClick}
                     >
                        <OptionIcon className="size-4 mr-2" />
                        {option.label}
                     </DropdownMenuItem>
                  );
               })}
            </DropdownMenuContent>
         </DropdownMenu>
      </SidebarHeader>
   );
}

// ============================================
// Item Context Menu
// ============================================

export type ItemContextMenuProps = {
   url: string;
   onRemove?: () => void;
   children: React.ReactNode;
};

export function ItemContextMenu({
   url,
   onRemove,
   children,
}: ItemContextMenuProps) {
   const handleOpenNewTab = () => {
      window.open(url, "_blank");
   };

   const handleOpenNewWindow = () => {
      window.open(url, "_blank", "noopener,noreferrer");
   };

   const handleCopyLink = async () => {
      try {
         const fullUrl = `${window.location.origin}${url}`;
         await navigator.clipboard.writeText(fullUrl);
         toast.success("Link copiado para a área de transferência");
      } catch {
         toast.error("Falha ao copiar o link");
      }
   };

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
         <DropdownMenuContent className="w-56">
            <DropdownMenuItem onClick={handleOpenNewTab}>
               <ExternalLink className="size-4 mr-2" />
               Abrir em nova aba
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenNewWindow}>
               <ExternalLink className="size-4 mr-2" />
               Abrir em nova janela
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
               <Copy className="size-4 mr-2" />
               Copiar endereço do link
            </DropdownMenuItem>
            {onRemove && (
               <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onRemove} variant="destructive">
                     <X className="size-4 mr-2" />
                     Remover do painel
                  </DropdownMenuItem>
               </>
            )}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
