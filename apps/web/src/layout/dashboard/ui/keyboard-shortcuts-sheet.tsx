import {
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
   CommandSeparator,
} from "@packages/ui/components/command";
import { Kbd, KbdGroup } from "@packages/ui/components/kbd";
import { openCommandDialog } from "@/hooks/use-command-dialog";
import { SHORTCUT_GROUPS, formatShortcutKeys } from "./keyboard-shortcuts";

function KeyboardShortcutsContent() {
   return (
      <>
         <CommandInput placeholder="Buscar atalhos..." />
         <CommandList className="max-h-[calc(75vh-3rem)]">
            <CommandEmpty>Nenhum atalho encontrado.</CommandEmpty>
            {SHORTCUT_GROUPS.map((group, index) => (
               <>
                  {index > 0 && <CommandSeparator key={`sep-${group.id}`} />}
                  <CommandGroup heading={group.label} key={group.id}>
                     {group.shortcuts.map((shortcut) => {
                        const keys = formatShortcutKeys(shortcut.keys);
                        return (
                           <CommandItem
                              key={shortcut.keys}
                              className="flex items-center justify-between"
                              value={shortcut.label}
                              onSelect={() => {}}
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
               </>
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
