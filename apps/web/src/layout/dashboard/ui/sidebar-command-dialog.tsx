import {
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
   CommandSeparator,
} from "@packages/ui/components/command";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { useSidebarVisibility } from "@/layout/dashboard/hooks/use-sidebar-store";
import { navGroups } from "@/layout/dashboard/ui/sidebar-nav-items";

interface SidebarCommandDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
}

export function SidebarCommandDialog({
   open,
   onOpenChange,
}: SidebarCommandDialogProps) {
   const navigate = useNavigate();
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const { isEnrolled } = useEarlyAccess();
   const { isVisible } = useSidebarVisibility();

   useEffect(() => {
      const handler = (e: KeyboardEvent) => {
         if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            onOpenChange(!open);
         }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
   }, [open, onOpenChange]);

   const handleSelect = (route: string) => {
      onOpenChange(false);
      navigate({ to: route, params: { slug, teamSlug: teamSlug ?? "" } });
   };

   const visibleGroups = navGroups
      .map((group) => ({
         ...group,
         items: group.items.filter((item) => {
            if (item.earlyAccessFlag && !isEnrolled(item.earlyAccessFlag))
               return false;
            return isVisible(item.id);
         }),
      }))
      .filter((group) => group.items.length > 0);

   return (
      <CommandDialog
         className="top-[8vh] translate-y-0 max-h-[75vh]"
         description="Navegue para qualquer página"
         open={open}
         showCloseButton={false}
         title="Buscar"
         onOpenChange={onOpenChange}
      >
         <CommandInput placeholder="Buscar páginas..." />
         <CommandList className="max-h-[calc(75vh-3rem)]">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            {visibleGroups.map((group, index) => (
               <>
                  {index > 0 && <CommandSeparator key={`sep-${group.id}`} />}
                  <CommandGroup
                     heading={group.label ?? "Projeto"}
                     key={group.id}
                  >
                     {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                           <CommandItem
                              key={item.id}
                              onSelect={() => handleSelect(item.route)}
                           >
                              <Icon className={item.iconColor} />
                              {item.label}
                           </CommandItem>
                        );
                     })}
                  </CommandGroup>
               </>
            ))}
         </CommandList>
      </CommandDialog>
   );
}
