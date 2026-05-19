import {
   ComposerPrimitive,
   ThreadPrimitive,
   useAuiState,
} from "@assistant-ui/react";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@packages/ui/lib/utils";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import {
   SCOPES,
   selectScope,
   useMontteSuggestions,
   useSelectedScope,
} from "./chat-runtime";

type Effort = "high" | "xhigh";

const EFFORTS = [
   { id: "high", label: "Profundo" },
   { id: "xhigh", label: "Máximo" },
] satisfies Array<{ id: Effort; label: string }>;

const EFFORT_LABELS = {
   high: "Profundo",
   xhigh: "Máximo",
} satisfies Record<Effort, string>;

interface ComposerProps {
   className?: string;
   placeholder?: string;
}

export function Composer({
   className,
   placeholder = "Faça uma pergunta ou / para comandos",
}: ComposerProps) {
   const suggestions = useMontteSuggestions();
   const isThreadEmpty = useAuiState((s) => s.thread.isEmpty);

   return (
      <div className={cn("flex flex-col gap-2", className)}>
         {isThreadEmpty && suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
               {suggestions.map((prompt) => (
                  <ThreadPrimitive.Suggestion
                     asChild
                     key={prompt}
                     prompt={prompt}
                     send
                  >
                     <Button
                        className="h-auto whitespace-normal rounded-full border-dashed p-2 text-left text-xs"
                        size="sm"
                        type="button"
                        variant="outline"
                     >
                        {prompt}
                     </Button>
                  </ThreadPrimitive.Suggestion>
               ))}
            </div>
         ) : null}

         <ComposerPrimitive.Root className="w-full rounded-lg border bg-background/95 shadow-sm">
            <ComposerPrimitive.Input
               aria-label="Mensagem para a Montte AI"
               className="min-h-[72px] w-full resize-none border-0 bg-transparent p-4 text-base shadow-none outline-none focus-visible:border-transparent focus-visible:ring-0"
               placeholder={placeholder}
               submitMode="enter"
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
               <div className="flex items-center gap-2">
                  <ScopePicker />
                  <EffortPicker />
               </div>
               <ComposerPrimitive.Send asChild>
                  <Button
                     aria-label="Enviar"
                     className="h-8 w-8 rounded-md"
                     size="icon"
                     type="submit"
                  >
                     <ArrowRight className="size-4" />
                  </Button>
               </ComposerPrimitive.Send>
            </div>
         </ComposerPrimitive.Root>
      </div>
   );
}

export function EditComposer() {
   return (
      <ComposerPrimitive.Root className="flex flex-col items-end gap-2">
         <ComposerPrimitive.Input
            aria-label="Editar mensagem"
            className="max-w-[85%] resize-none rounded-lg border bg-background p-4 text-base shadow-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
            submitMode="enter"
         />
         <div className="flex items-center gap-2">
            <ComposerPrimitive.Cancel asChild>
               <Button size="sm" type="button" variant="ghost">
                  Cancelar
               </Button>
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send asChild>
               <Button size="sm" type="submit">
                  Enviar
               </Button>
            </ComposerPrimitive.Send>
         </div>
      </ComposerPrimitive.Root>
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
                  className="flex w-full items-center justify-start gap-2 rounded-sm p-2 text-xs"
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
   return (
      <QueryBoundary
         fallback={<Skel />}
         errorTitle="Erro ao carregar configurações da Montte AI"
      >
         <EffortPickerContent />
      </QueryBoundary>
   );
}

function Skel() {
   return <Skeleton className="h-7 w-24 rounded-full" />;
}

function EffortPickerContent() {
   const [open, setOpen] = useState(false);
   const { data: settings } = useSuspenseQuery(
      orpc.agentSettings.getSettings.queryOptions(),
   );
   const update = useMutation(
      orpc.agentSettings.upsertSettings.mutationOptions(),
   );

   const selected = settings.reasoningEffort ?? "high";

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
               {EFFORT_LABELS[selected]}
               <ChevronDown className="size-4" />
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-40 p-2" sideOffset={4}>
            {EFFORTS.map((effort) => (
               <Button
                  className="flex w-full items-center justify-start gap-2 rounded-sm p-2 text-xs"
                  key={effort.id}
                  onClick={() => {
                     update.mutate({ reasoningEffort: effort.id });
                     setOpen(false);
                  }}
                  variant="ghost"
               >
                  <Brain className="size-4 text-muted-foreground" />
                  <span>{effort.label}</span>
                  {selected === effort.id ? (
                     <Check className="size-4 text-primary" />
                  ) : null}
               </Button>
            ))}
         </PopoverContent>
      </Popover>
   );
}
