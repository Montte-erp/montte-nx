import { EMAIL_VARIABLES } from "@packages/transactional/schemas/email-builder.schema";
import {
   Select,
   SelectContent,
   SelectGroup,
   SelectItem,
   SelectLabel,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";

type VariableSelectProps = {
   onSelect: (variable: string) => void;
};

export function VariableSelect({ onSelect }: VariableSelectProps) {
   const groupedVariables = EMAIL_VARIABLES.reduce(
      (acc, variable) => {
         const category = variable.category;
         if (!acc[category]) {
            acc[category] = [];
         }
         acc[category].push(variable);
         return acc;
      },
      {} as Record<string, (typeof EMAIL_VARIABLES)[number][]>,
   );

   const categoryLabels: Record<string, string> = {
      organization: "Organização",
      user: "Usuário",
      date: "Data",
      bills: "Contas",
   };

   const handleValueChange = (value: string) => {
      if (value) {
         onSelect(`{{${value}}}`);
      }
   };

   return (
      <Select onValueChange={handleValueChange} value="">
         <SelectTrigger className="w-36">
            <SelectValue placeholder="Variável..." />
         </SelectTrigger>
         <SelectContent>
            {Object.entries(groupedVariables).map(([category, variables]) => (
               <SelectGroup key={category}>
                  <SelectLabel>
                     {categoryLabels[category] ?? category}
                  </SelectLabel>
                  {variables.map((variable) => (
                     <SelectItem key={variable.key} value={variable.key}>
                        {variable.label}
                     </SelectItem>
                  ))}
               </SelectGroup>
            ))}
         </SelectContent>
      </Select>
   );
}
