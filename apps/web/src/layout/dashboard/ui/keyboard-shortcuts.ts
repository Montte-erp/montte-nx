export type ShortcutDef = {
   keys: string;
   label: string;
};

export type ShortcutGroup = {
   id: string;
   label: string;
   shortcuts: ShortcutDef[];
};

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
   {
      id: "global",
      label: "Global",
      shortcuts: [
         { keys: "Mod+K", label: "Busca global" },
         { keys: "Mod+/", label: "Atalhos de teclado" },
      ],
   },
];

export function formatShortcutKeys(keys: string): string[] {
   const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
   return keys
      .split("+")
      .map((k) => (k === "Mod" ? (isMac ? "⌘" : "Ctrl") : k));
}
