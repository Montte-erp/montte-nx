import { ChevronRight, Loader2, Wrench } from "lucide-react";
import { useState } from "react";
interface ToolCallCardProps {
   toolCall: {
      id: string;
      name: string;
      args: string;
      state?: "streaming" | "complete" | "result";
      result?: string;
   };
}

function formatArgs(raw: string): string {
   if (!raw) return "";
   const parsed = (() => {
      try {
         return JSON.parse(raw);
      } catch {
         return null;
      }
   })();
   if (parsed === null) return raw;
   return JSON.stringify(parsed, null, 2);
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
   const [open, setOpen] = useState(false);
   const isRunning = toolCall.state === "streaming";
   return (
      <div className="rounded-md border border-muted-foreground/20 bg-muted/30 text-xs">
         <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
         >
            <ChevronRight
               className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            />
            {isRunning ? (
               <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
            ) : (
               <Wrench className="size-3 shrink-0 text-muted-foreground" />
            )}
            <span className="font-mono">{toolCall.name || "tool"}</span>
            {toolCall.state === "result" ? (
               <span className="ml-auto text-muted-foreground">ok</span>
            ) : isRunning ? (
               <span className="ml-auto text-muted-foreground shimmer">
                  executando…
               </span>
            ) : null}
         </button>
         {open ? (
            <div className="grid gap-2 border-t border-muted-foreground/20 px-2 py-2">
               {toolCall.args ? (
                  <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-snug">
                     {formatArgs(toolCall.args)}
                  </pre>
               ) : (
                  <span className="text-muted-foreground">sem argumentos</span>
               )}
               {toolCall.result ? (
                  <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-snug">
                     {toolCall.result}
                  </pre>
               ) : null}
            </div>
         ) : null}
      </div>
   );
}
