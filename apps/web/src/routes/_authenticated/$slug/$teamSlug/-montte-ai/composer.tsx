import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { z } from "zod";
import {
   SCOPES,
   selectScope,
   setScopeOpen,
   useChatSession,
   useScopeOpen,
   useSelectedScope,
} from "./chat-store";

const composerSchema = z.object({ message: z.string().min(1) });

interface ComposerProps {
   session: ReturnType<typeof useChatSession>;
   className?: string;
   placeholder?: string;
}

export function Composer({
   session,
   className,
   placeholder = "Faça uma pergunta ou / para comandos",
}: ComposerProps) {
   const { sendMessage, isStreaming } = session;

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

   return (
      <form
         className={className}
         onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
         }}
      >
         <div className="w-full rounded-xl border bg-background">
            <form.Field name="message">
               {(field) => (
                  <Textarea
                     aria-invalid={field.state.meta.errors.length > 0}
                     aria-label="Mensagem para a Montte AI"
                     className="min-h-[80px] resize-none border-0 bg-transparent px-4 py-2 text-base shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                     disabled={isStreaming}
                     id={field.name}
                     name={field.name}
                     onChange={(e) => field.handleChange(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                           e.preventDefault();
                           void form.handleSubmit();
                        }
                     }}
                     placeholder={placeholder}
                     value={field.state.value}
                  />
               )}
            </form.Field>
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
               <ScopePicker />
               <form.Subscribe selector={(s) => s.canSubmit}>
                  {(canSubmit) => (
                     <Button
                        aria-label="Enviar"
                        className="size-8 rounded-md"
                        disabled={!canSubmit || isStreaming}
                        size="icon"
                        type="submit"
                     >
                        <ArrowRight />
                     </Button>
                  )}
               </form.Subscribe>
            </div>
         </div>
      </form>
   );
}

function ScopePicker() {
   const selected = useSelectedScope();
   const open = useScopeOpen();

   return (
      <Popover onOpenChange={setScopeOpen} open={open}>
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
                  onClick={() => selectScope(scope.id)}
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
