import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import {
   ArrowRight,
   Brain,
   Check,
   ChevronDown,
   Maximize2,
   Minimize2,
   Square,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { cn } from "@packages/ui/lib/utils";
import { orpc } from "@/integrations/orpc/client";
import {
   SCOPES,
   selectScope,
   useChatSession,
   useSelectedScope,
} from "./chat-store";

const composerSchema = z.object({ message: z.string().min(1) });

const EFFORTS = [
   { id: "low", label: "Rápido" },
   { id: "medium", label: "Equilibrado" },
   { id: "high", label: "Profundo" },
] as const;

type Effort = (typeof EFFORTS)[number]["id"];

interface ComposerProps {
   className?: string;
   placeholder?: string;
}

export function Composer({
   className,
   placeholder = "Faça uma pergunta ou / para comandos",
}: ComposerProps) {
   const { sendMessage, stop, isStreaming, isSubmitting, suggestions } =
      useChatSession();
   const busy = isStreaming || isSubmitting;
   const [expanded, setExpanded] = useState(false);

   const form = useForm({
      defaultValues: { message: "" },
      validators: { onChange: composerSchema },
      onSubmit: ({ value, formApi }) => {
         const text = value.message.trim();
         if (!text) return;
         formApi.reset();
         void sendMessage(text);
      },
   });

   const showSuggestions = !busy && suggestions.length > 0;

   return (
      <form
         className={cn("flex flex-col gap-2", className)}
         onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
         }}
      >
         {showSuggestions ? (
            <div className="flex flex-wrap gap-2">
               {suggestions.map((text) => (
                  <Button
                     className="h-auto whitespace-normal rounded-full border-dashed px-3 py-1.5 text-left text-xs"
                     key={text}
                     onClick={() => void sendMessage(text)}
                     size="sm"
                     type="button"
                     variant="outline"
                  >
                     {text}
                  </Button>
               ))}
            </div>
         ) : null}
         <div className="relative w-full rounded-xl border bg-background">
            <Button
               aria-label={expanded ? "Recolher" : "Expandir"}
               className="absolute right-2 top-2 size-7 text-muted-foreground"
               onClick={() => setExpanded((v) => !v)}
               size="icon"
               type="button"
               variant="ghost"
            >
               {expanded ? (
                  <Minimize2 className="size-4" />
               ) : (
                  <Maximize2 className="size-4" />
               )}
            </Button>
            <form.Field name="message">
               {(field) => (
                  <Textarea
                     aria-invalid={field.state.meta.errors.length > 0}
                     aria-label="Mensagem para a Montte AI"
                     className={cn(
                        "resize-none border-0 bg-transparent px-4 py-2 pr-10 text-base shadow-none focus-visible:ring-0 focus-visible:border-transparent",
                        expanded ? "min-h-[320px]" : "min-h-[80px]",
                     )}
                     id={field.name}
                     name={field.name}
                     onChange={(e) => field.handleChange(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        if (e.shiftKey) return;
                        e.preventDefault();
                        if (busy) return;
                        void form.handleSubmit();
                     }}
                     placeholder={placeholder}
                     value={field.state.value}
                  />
               )}
            </form.Field>
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
               <div className="flex items-center gap-2">
                  <ScopePicker />
                  <EffortPicker />
               </div>
               {busy ? (
                  <Button
                     aria-label="Parar"
                     className="size-8 rounded-md"
                     onClick={stop}
                     size="icon"
                     type="button"
                     variant="secondary"
                  >
                     <Square className="size-4 fill-current" />
                  </Button>
               ) : (
                  <form.Subscribe selector={(s) => s.canSubmit}>
                     {(canSubmit) => (
                        <Button
                           aria-label="Enviar"
                           className="size-8 rounded-md"
                           disabled={!canSubmit}
                           size="icon"
                           type="submit"
                        >
                           <ArrowRight />
                        </Button>
                     )}
                  </form.Subscribe>
               )}
            </div>
         </div>
      </form>
   );
}

function ScopePicker() {
   const selected = useSelectedScope();
   const [open, setOpen] = useState(false);

   return (
      <Popover onOpenChange={setOpen} open={open}>
         <PopoverTrigger asChild>
            <Button
               className="h-7 gap-2 rounded-full px-2 text-xs font-normal text-muted-foreground"
               size="sm"
               type="button"
               variant="outline"
            >
               <selected.icon className="size-4" />
               {selected.label}
               <ChevronDown className="size-4" />
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-44 p-2" sideOffset={4}>
            {SCOPES.map((scope) => (
               <Button
                  className="flex w-full items-center justify-start gap-2 rounded-sm px-2 py-2 text-xs"
                  key={scope.id}
                  onClick={() => {
                     selectScope(scope.id);
                     setOpen(false);
                  }}
                  variant="ghost"
               >
                  <scope.icon className="size-4 text-muted-foreground" />
                  <span>{scope.label}</span>
                  {selected.id === scope.id ? (
                     <Check className="size-4 text-primary" />
                  ) : null}
               </Button>
            ))}
         </PopoverContent>
      </Popover>
   );
}

function EffortPicker() {
   const [open, setOpen] = useState(false);
   const { data: settings } = useSuspenseQuery(
      orpc.agentSettings.getSettings.queryOptions(),
   );
   const update = useMutation(
      orpc.agentSettings.upsertSettings.mutationOptions(),
   );

   const current: Effort = settings?.reasoningEffort ?? "low";
   const currentLabel =
      EFFORTS.find((e) => e.id === current)?.label ?? "Rápido";

   return (
      <Popover onOpenChange={setOpen} open={open}>
         <PopoverTrigger asChild>
            <Button
               className="h-7 gap-2 rounded-full px-2 text-xs font-normal text-muted-foreground"
               size="sm"
               type="button"
               variant="outline"
            >
               <Brain className="size-4" />
               {currentLabel}
               <ChevronDown className="size-4" />
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-44 p-2" sideOffset={4}>
            {EFFORTS.map((effort) => (
               <Button
                  className="flex w-full items-center justify-start gap-2 rounded-sm px-2 py-2 text-xs"
                  key={effort.id}
                  onClick={() => {
                     update.mutate({ reasoningEffort: effort.id });
                     setOpen(false);
                  }}
                  variant="ghost"
               >
                  <span>{effort.label}</span>
                  {current === effort.id ? (
                     <Check className="size-4 text-primary" />
                  ) : null}
               </Button>
            ))}
         </PopoverContent>
      </Popover>
   );
}
