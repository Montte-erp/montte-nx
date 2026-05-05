import { Badge } from "@packages/ui/components/badge";
import { Sparkles } from "lucide-react";

interface SkillData {
   id?: string;
   name?: string;
   description?: string;
}

interface SkillArgs {
   skillId?: string;
}

export function SkillDiscoverRenderer({
   data,
   args,
}: {
   data: SkillData;
   args: SkillArgs | null;
}) {
   const name = data.name ?? args?.skillId ?? "—";
   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-muted-foreground">Skill ativada</span>
            <Badge variant="outline" className="font-medium">
               {name}
            </Badge>
         </div>
         {data.description ? (
            <p className="text-muted-foreground">{data.description}</p>
         ) : null}
      </div>
   );
}
