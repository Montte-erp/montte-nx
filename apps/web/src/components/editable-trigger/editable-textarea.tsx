import { Textarea } from "@packages/ui/components/textarea";
import { EditableTrigger, type EditableTriggerProps } from "./editable-trigger";

interface EditableTextareaProps extends Omit<
   EditableTriggerProps<string>,
   "children"
> {
   placeholder?: string;
   rows?: number;
}

export function EditableTextarea({
   placeholder,
   rows = 3,
   ...rest
}: EditableTextareaProps) {
   return (
      <EditableTrigger<string> {...rest}>
         {({ value, setValue, commit, cancel }) => (
            <Textarea
               aria-label={rest.ariaLabel}
               autoFocus
               className="min-h-0 resize-none"
               onBlur={commit}
               onChange={(e) => setValue(e.target.value)}
               onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                     e.preventDefault();
                     commit();
                  }
                  if (e.key === "Escape") {
                     e.preventDefault();
                     cancel();
                  }
               }}
               placeholder={placeholder}
               rows={rows}
               value={value}
            />
         )}
      </EditableTrigger>
   );
}
