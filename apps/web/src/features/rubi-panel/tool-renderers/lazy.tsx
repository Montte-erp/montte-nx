import { Compass } from "lucide-react";

interface LazyData {
   tools?: Array<{ name?: string; description?: string }>;
}

export function LazyDiscoveryRenderer({ data }: { data: LazyData }) {
   const tools = data.tools ?? [];
   if (tools.length === 0) return null;
   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center gap-2">
            <Compass className="size-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-muted-foreground">
               {tools.length} ferramenta{tools.length === 1 ? "" : "s"}{" "}
               carregada{tools.length === 1 ? "" : "s"}
            </span>
         </div>
         <div className="flex flex-wrap gap-1">
            {tools.map((t, i) => (
               <span
                  key={`${t.name ?? "tool"}-${i}`}
                  className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px]"
                  title={t.description}
               >
                  {t.name ?? "tool"}
               </span>
            ))}
         </div>
      </div>
   );
}
