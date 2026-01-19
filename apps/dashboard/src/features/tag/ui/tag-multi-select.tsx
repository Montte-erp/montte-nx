import type { RouterOutput } from "@packages/api/client";
import { MultiSelect, type Option } from "@packages/ui/components/multi-select";
import { Tag } from "lucide-react";

type TagType = RouterOutput["tags"]["getAll"][0];

type TagMultiSelectProps = {
   tags: TagType[];
   selected: string[];
   onChange: (selected: string[]) => void;
   onCreate?: (name: string) => void;
   placeholder?: string;
   className?: string;
};

export function TagMultiSelect({
   tags,
   selected,
   onChange,
   onCreate,
   placeholder = "Selecione tags...",
   className,
}: TagMultiSelectProps) {
   const tagOptions: Option[] = tags.map((tag) => ({
      icon: <Tag className="size-4" style={{ color: tag.color }} />,
      label: tag.name,
      value: tag.id,
   }));

   return (
      <MultiSelect
         className={className}
         createLabel={onCreate ? "Criar tag" : undefined}
         emptyMessage="Nenhum resultado encontrado"
         onChange={onChange}
         onCreate={onCreate}
         options={tagOptions}
         placeholder={placeholder}
         selected={selected}
      />
   );
}
