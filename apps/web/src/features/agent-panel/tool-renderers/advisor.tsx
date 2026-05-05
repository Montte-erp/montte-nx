import { Streamdown } from "streamdown";

interface AdvisorData {
   guidance?: string;
   fallback?: boolean;
   error?: string;
}

interface AdvisorArgs {
   situation?: string;
   question?: string;
   options?: string[];
}

export function AdvisorRenderer({
   data,
   args,
}: {
   data: AdvisorData;
   args: AdvisorArgs | null;
}) {
   if (!data.guidance) return null;
   return (
      <div className="flex flex-col gap-3">
         {args?.question ? (
            <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pergunta
               </span>
               <span className="italic text-muted-foreground">
                  {args.question}
               </span>
            </div>
         ) : null}
         {args?.options && args.options.length > 0 ? (
            <div className="flex flex-col gap-1">
               <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Opções
               </span>
               <ul className="flex flex-col gap-0.5 pl-4">
                  {args.options.map((o, i) => (
                     <li
                        key={`opt-${i}`}
                        className="list-disc text-muted-foreground"
                     >
                        {o}
                     </li>
                  ))}
               </ul>
            </div>
         ) : null}
         <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
               {data.fallback ? "Advisor indisponível" : "Conselho"}
            </span>
            <Streamdown mode="static" isAnimating={false}>
               {data.guidance}
            </Streamdown>
         </div>
      </div>
   );
}
