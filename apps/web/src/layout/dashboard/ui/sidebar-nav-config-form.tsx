import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { FeatureStageBadge } from "@packages/ui/components/feature-stage-badge";
import { useMemo } from "react";
import { useEarlyAccess } from "@/hooks/use-early-access";
import { useFinanceNavPreferences } from "@/layout/dashboard/hooks/use-finance-nav-preferences";
import { useSidebarVisibility } from "@/layout/dashboard/hooks/use-sidebar-visibility";
import type { NavItemDef } from "@/layout/dashboard/ui/sidebar-nav-items";
import { navGroups } from "@/layout/dashboard/ui/sidebar-nav-items";

const labeledNavGroups = navGroups.filter((g) => g.label);

const mainEarlyAccessItems = navGroups
   .filter((g) => !g.label)
   .flatMap((g) => g.items)
   .filter((item) => item.earlyAccessFlag);

const labeledGroupItemIds = new Set(
   labeledNavGroups.flatMap((g) => g.items.map((i) => i.id)),
);

export function SidebarNavConfigForm({ onClose }: { onClose: () => void }) {
   const { hiddenItems, toggleItem: toggleVisibility } = useSidebarVisibility();
   const { wantedItems, toggleItem: toggleWanted } = useFinanceNavPreferences();
   const { updateEnrollment, getFeatureStage, isEnrolled } = useEarlyAccess();

   const visibleLabeledNavGroups = useMemo(
      () =>
         labeledNavGroups
            .map((g) => ({
               ...g,
               items: g.items.filter(
                  (item) =>
                     !item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag),
               ),
            }))
            .filter((g) => g.items.length > 0),
      [isEnrolled],
   );

   const visibleMainEarlyAccessItems = useMemo(
      () =>
         mainEarlyAccessItems.filter(
            (item) =>
               !item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag!),
         ),
      [isEnrolled],
   );

   const isChecked = (item: NavItemDef): boolean => {
      if (item.earlyAccessFlag) {
         if (labeledGroupItemIds.has(item.id)) {
            return (
               wantedItems.includes(item.id) || isEnrolled(item.earlyAccessFlag)
            );
         }
         return isEnrolled(item.earlyAccessFlag);
      }
      return !hiddenItems.includes(item.id);
   };

   const handleToggle = (item: NavItemDef) => {
      if (item.earlyAccessFlag) {
         const newValue = !isChecked(item);
         if (labeledGroupItemIds.has(item.id)) {
            const inWanted = wantedItems.includes(item.id);
            if (newValue !== inWanted) {
               toggleWanted(item.id);
            }
         }
         updateEnrollment(item.earlyAccessFlag, newValue);
      } else {
         toggleVisibility(item.id);
      }
   };

   const getSectionState = (items: NavItemDef[]): boolean | "indeterminate" => {
      const checkedCount = items.filter(isChecked).length;
      if (checkedCount === 0) return false;
      if (checkedCount === items.length) return true;
      return "indeterminate";
   };

   const toggleSection = (
      items: NavItemDef[],
      currentState: boolean | "indeterminate",
   ) => {
      const targetChecked = currentState !== true;
      for (const item of items) {
         if (isChecked(item) !== targetChecked) {
            handleToggle(item);
         }
      }
   };

   const renderSection = (
      sectionId: string,
      sectionLabel: string,
      items: NavItemDef[],
   ) => {
      const sectionState = getSectionState(items);
      return (
         <div key={sectionId}>
            <div className="flex items-center gap-3 mb-3">
               <Checkbox
                  checked={sectionState}
                  id={`section-${sectionId}`}
                  onCheckedChange={() => toggleSection(items, sectionState)}
               />
               <label
                  className="text-sm font-medium cursor-pointer select-none"
                  htmlFor={`section-${sectionId}`}
               >
                  {sectionLabel}
               </label>
            </div>
            <div className="flex flex-col gap-2 ml-7">
               {items.map((item) => {
                  const Icon = item.icon;
                  const stage = item.earlyAccessFlag
                     ? getFeatureStage(item.earlyAccessFlag)
                     : null;
                  return (
                     <div className="flex items-center gap-3" key={item.id}>
                        <Checkbox
                           checked={isChecked(item)}
                           id={`sidebar-config-${item.id}`}
                           onCheckedChange={() => handleToggle(item)}
                        />
                        <label
                           className="flex items-center gap-2 text-sm cursor-pointer select-none flex-1"
                           htmlFor={`sidebar-config-${item.id}`}
                        >
                           <Icon className="size-4 text-muted-foreground" />
                           <span>{item.label}</span>
                           {stage && (
                              <FeatureStageBadge
                                 className="ml-auto"
                                 stage={stage}
                              />
                           )}
                        </label>
                     </div>
                  );
               })}
            </div>
         </div>
      );
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Personalizar barra lateral</CredenzaTitle>
            <CredenzaDescription>
               Escolha quais itens exibir na navegação.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <p className="text-sm text-muted-foreground mb-6">
               Selecione os itens que deseja ver na barra lateral.
            </p>
            <div className="flex flex-col gap-4">
               {visibleLabeledNavGroups.map((group) =>
                  renderSection(
                     group.id,
                     group.label!,
                     group.items.flatMap((item) =>
                        item.children
                           ? item.children.filter((c) => c.configurable)
                           : item.configurable
                             ? [item]
                             : [],
                     ),
                  ),
               )}
               {visibleMainEarlyAccessItems.length > 0 &&
                  renderSection(
                     "funcionalidades",
                     "Funcionalidades",
                     visibleMainEarlyAccessItems,
                  )}
            </div>
            <div className="flex justify-end mt-6">
               <Button onClick={onClose} variant="outline">
                  Fechar
               </Button>
            </div>
         </CredenzaBody>
      </>
   );
}
