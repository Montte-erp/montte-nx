import type { RouterOutput } from "@packages/api/client";
import { MultiSelect, type Option } from "@packages/ui/components/multi-select";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";

type Category = RouterOutput["categories"]["getAll"][0];

type CategoryMultiSelectProps = {
   categories: Category[];
   selected: string[];
   onChange: (selected: string[]) => void;
   onCreate?: (name: string) => void;
   placeholder?: string;
   className?: string;
};

export function CategoryMultiSelect({
   categories,
   selected,
   onChange,
   onCreate,
   placeholder = "Selecione categorias...",
   className,
}: CategoryMultiSelectProps) {
   const categoryOptions: Option[] = categories.map((category) => ({
      icon: (
         <div
            className="flex size-4 items-center justify-center rounded"
            style={{ backgroundColor: category.color }}
         >
            <IconDisplay iconName={category.icon as IconName} size={10} />
         </div>
      ),
      label: category.name,
      value: category.id,
   }));

   return (
      <MultiSelect
         className={className}
         createLabel={onCreate ? "Criar categoria" : undefined}
         emptyMessage="Nenhum resultado encontrado"
         onChange={onChange}
         onCreate={onCreate}
         options={categoryOptions}
         placeholder={placeholder}
         selected={selected}
      />
   );
}
