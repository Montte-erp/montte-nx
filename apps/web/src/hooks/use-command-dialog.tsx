import {
   CommandDialog,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
   CommandSeparator,
} from "@packages/ui/components/command";
import { createStore, useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import type React from "react";

type CommandItemDef = {
   id: string;
   label: string;
   icon?: React.ElementType;
   iconColor?: string;
   onSelect: () => void;
};

type CommandGroupDef = {
   id: string;
   label?: string;
   items: CommandItemDef[];
};

type CommandDialogOptions =
   | {
        groups: CommandGroupDef[];
        renderContent?: never;
        placeholder?: string;
        description?: string;
        title?: string;
     }
   | {
        renderContent: () => React.ReactNode;
        groups?: never;
        placeholder?: never;
        description?: string;
        title?: string;
     };

const commandDialogStore = createStore<{
   open: boolean;
   options: CommandDialogOptions | null;
}>({
   open: false,
   options: null,
});

export const openCommandDialog = (options: CommandDialogOptions) =>
   commandDialogStore.setState(() => ({ open: true, options }));

export const closeCommandDialog = () =>
   commandDialogStore.setState(() => ({ open: false, options: null }));

export const useCommandDialog = () => ({
   openCommandDialog,
   closeCommandDialog,
});

export function GlobalCommandDialog() {
   const { open, options } = useStore(commandDialogStore, (s) => s);

   if (!options) return null;

   return (
      <CommandDialog
         className="top-[8vh] translate-y-0 max-h-[75vh]"
         description={options.description ?? ""}
         open={open}
         showCloseButton={false}
         title={options.title ?? "Buscar"}
         onOpenChange={(v) => {
            if (!v) closeCommandDialog();
         }}
      >
         {options.renderContent ? (
            options.renderContent()
         ) : (
            <>
               <CommandInput
                  placeholder={options.placeholder ?? "Buscar páginas..."}
               />
               <CommandList className="max-h-[calc(75vh-3rem)]">
                  <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
                  {options.groups
                     .filter((g) => g.items.length > 0)
                     .map((group, index) => (
                        <Fragment key={group.id}>
                           {index > 0 && <CommandSeparator />}
                           <CommandGroup heading={group.label ?? "Projeto"}>
                              {group.items.map((item) => {
                                 const Icon = item.icon;
                                 return (
                                    <CommandItem
                                       key={item.id}
                                       onSelect={() => {
                                          closeCommandDialog();
                                          item.onSelect();
                                       }}
                                    >
                                       {Icon && (
                                          <Icon
                                             aria-hidden="true"
                                             className={item.iconColor}
                                          />
                                       )}
                                       {item.label}
                                    </CommandItem>
                                 );
                              })}
                           </CommandGroup>
                        </Fragment>
                     ))}
               </CommandList>
            </>
         )}
      </CommandDialog>
   );
}
