import {
   DndContext,
   KeyboardSensor,
   MouseSensor,
   TouchSensor,
   closestCenter,
   useSensor,
   useSensors,
   type DragEndEvent,
} from "@dnd-kit/core";
import {
   SortableContext,
   arrayMove,
   sortableKeyboardCoordinates,
   useSortable,
   verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { SidebarMenu, SidebarMenuItem } from "@packages/ui/components/sidebar";
import { Switch } from "@packages/ui/components/switch";
import { cn } from "@packages/ui/lib/utils";
import { GripVertical } from "lucide-react";
import { useId, useMemo, type CSSProperties } from "react";
import { useEarlyAccess } from "@/hooks/use-early-access";
import {
   setSidebarItemOrder,
   toggleFinanceNavPref,
   toggleHiddenItem,
   useIsFinanceItemWanted,
   useIsItemVisible,
   useSidebarItemOrder,
} from "./hooks/use-sidebar-store";
import type { NavGroupDef, NavItemDef } from "./sidebar-nav-items";
import { navGroups } from "./sidebar-nav-items";
import { getOrderedItems } from "./sidebar-utils";

function SidebarCustomizeItem({ item }: { item: NavItemDef }) {
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id: item.id });
   const { isEnrolled, updateEnrollment } = useEarlyAccess();
   const isVisible = useIsItemVisible();
   const isWanted = useIsFinanceItemWanted();
   const Icon = item.icon;
   const checked = item.earlyAccessFlag
      ? isWanted(item.id) || isEnrolled(item.earlyAccessFlag)
      : isVisible(item.id);
   const style: CSSProperties = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
   };

   function setVisibility(nextVisible: boolean) {
      if (nextVisible === checked) return;

      if (item.earlyAccessFlag) {
         toggleFinanceNavPref(item.id);
         updateEnrollment(item.earlyAccessFlag, nextVisible);
         return;
      }

      toggleHiddenItem(item.id);
   }

   return (
      <SidebarMenuItem ref={setNodeRef} style={style}>
         <Item className="gap-2 px-0 py-2" size="sm">
            <Button
               {...attributes}
               {...listeners}
               aria-label={`Reordenar ${item.label}`}
               className="cursor-grab text-muted-foreground active:cursor-grabbing"
               size="icon-xs"
               type="button"
               variant="ghost"
            >
               <GripVertical aria-hidden="true" className="size-4" />
            </Button>
            <ItemMedia>
               <Icon
                  aria-hidden="true"
                  className={cn("size-4 shrink-0", item.iconColor)}
               />
            </ItemMedia>
            <ItemContent className="min-w-0 gap-0">
               <ItemTitle className="truncate text-foreground">
                  {item.label}
               </ItemTitle>
            </ItemContent>
            <ItemActions>
               <ItemDescription>
                  {checked ? "Visível" : "Oculto"}
               </ItemDescription>
               <Switch
                  aria-label={`Mostrar ${item.label} na sidebar`}
                  checked={checked}
                  onCheckedChange={setVisibility}
               />
            </ItemActions>
         </Item>
      </SidebarMenuItem>
   );
}

function SidebarCustomizeGroup({ group }: { group: NavGroupDef }) {
   const dndId = useId();
   const { isEnrolled } = useEarlyAccess();
   const itemOrder = useSidebarItemOrder(group.id);
   const items = useMemo(
      () =>
         getOrderedItems(
            group.items.filter(
               (item) =>
                  !item.earlyAccessFlag || isEnrolled(item.earlyAccessFlag),
            ),
            itemOrder,
         ),
      [group.items, itemOrder, isEnrolled],
   );
   const itemIds = useMemo(() => items.map((item) => item.id), [items]);
   const mouseSensorOptions = useMemo(
      () => ({ activationConstraint: { distance: 5 } }),
      [],
   );
   const touchSensorOptions = useMemo(() => ({}), []);
   const keyboardSensorOptions = useMemo(
      () => ({ coordinateGetter: sortableKeyboardCoordinates }),
      [],
   );
   const sensors = useSensors(
      useSensor(MouseSensor, mouseSensorOptions),
      useSensor(TouchSensor, touchSensorOptions),
      useSensor(KeyboardSensor, keyboardSensorOptions),
   );

   function handleDragEnd(event: DragEndEvent) {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      setSidebarItemOrder(group.id, arrayMove(itemIds, oldIndex, newIndex));
   }

   if (items.length === 0) return null;

   return (
      <Card>
         {group.label && (
            <CardHeader>
               <CardTitle className="text-sm">{group.label}</CardTitle>
            </CardHeader>
         )}
         <DndContext
            id={dndId}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            sensors={sensors}
         >
            <SortableContext
               items={itemIds}
               strategy={verticalListSortingStrategy}
            >
               <CardContent>
                  <SidebarMenu>
                     {items.map((item) => (
                        <SidebarCustomizeItem item={item} key={item.id} />
                     ))}
                  </SidebarMenu>
               </CardContent>
            </SortableContext>
         </DndContext>
      </Card>
   );
}

export function SidebarCustomizeCredenza() {
   return (
      <>
         <CredenzaHeader className="flex-row items-start justify-between gap-4">
            <ItemContent className="gap-2">
               <CredenzaTitle>Customizar sidebar</CredenzaTitle>
               <CredenzaDescription>
                  Reordene os itens e escolha quais aparecem na navegação.
               </CredenzaDescription>
            </ItemContent>
         </CredenzaHeader>
         <CredenzaBody className="flex flex-col gap-4 px-4">
            {navGroups.map((group) => (
               <SidebarCustomizeGroup group={group} key={group.id} />
            ))}
         </CredenzaBody>
      </>
   );
}
