import {
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
   CommandSeparator,
} from "@packages/ui/components/command";
import { Kbd, KbdGroup } from "@packages/ui/components/kbd";
import { Fragment } from "react";
import { openCommandDialog } from "@/hooks/use-command-dialog";
import { SHORTCUT_GROUPS, formatShortcutKeys } from "./keyboard-shortcuts";

function KeyboardShortcutsContent() {
   return (
      <>
         <CommandInput placeholder="Buscar atalhos..." />
         <CommandList className="max-h-[calc(75vh-3rem)]">
            <CommandEmpty>Nenhum atalho encontrado.</CommandEmpty>
            {SHORTCUT_GROUPS.map((group, index) => (
               <Fragment key={group.id}>
                  {index > 0 && <CommandSeparator />}
                  <CommandGroup heading={group.label}>
                     {group.shortcuts.map((shortcut) => {
                        const keys = formatShortcutKeys(shortcut.keys);
                        return (
                           <CommandItem
                              key={shortcut.keys}
                              className="flex items-center justify-between"
                              value={shortcut.label}
                           >
                              <span>{shortcut.label}</span>
                              <KbdGroup>
                                 {keys.map((key, i) => (
                                    <Kbd key={`${shortcut.keys}-${i}`}>
                                       {key}
                                    </Kbd>
                                 ))}
                              </KbdGroup>
                           </CommandItem>
                        );
                     })}
                  </CommandGroup>
               </Fragment>
            ))}
         </CommandList>
      </>
   );
}

export function openKeyboardShortcuts() {
   openCommandDialog({
      title: "Atalhos de teclado",
      description: "Referência de atalhos de teclado",
      renderContent: () => <KeyboardShortcutsContent />,
   });
}
