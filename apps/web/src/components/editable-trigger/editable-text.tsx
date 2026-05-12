import { Input } from "@packages/ui/components/input";
import type React from "react";
import { EditableTrigger, type EditableTriggerProps } from "./editable-trigger";

interface EditableTextProps extends Omit<
   EditableTriggerProps<string>,
   "children"
> {
   placeholder?: string;
   type?: "text" | "number";
   inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

export function EditableText({
   placeholder,
   type = "text",
   inputMode,
   ...rest
}: EditableTextProps) {
   return (
      <EditableTrigger<string> {...rest}>
         {({ value, setValue, commit, cancel }) => (
            <Input
               aria-label={rest.ariaLabel}
               autoFocus
               className="h-8"
               inputMode={inputMode}
               onBlur={commit}
               onChange={(e) => setValue(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === "Enter") {
                     e.preventDefault();
                     commit();
                  }
                  if (e.key === "Escape") {
                     e.preventDefault();
                     cancel();
                  }
               }}
               placeholder={placeholder}
               type={type}
               value={value}
            />
         )}
      </EditableTrigger>
   );
}
