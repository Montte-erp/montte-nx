import { Button } from "@packages/ui/components/button";
import { Textarea } from "@packages/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
   ArrowRight,
   ArrowLeftRight,
   BarChart2,
   BotMessageSquare,
   Building2,
   Tag,
   Upload,
   Users,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/chat",
)({
   head: () => ({
      meta: [{ title: "Rubi — Montte" }],
   }),
   component: ChatPage,
});

const QUICK_ACTIONS = [
   { icon: ArrowLeftRight, label: "Lançamentos" },
   { icon: Tag, label: "Categorizar" },
   { icon: Users, label: "Contatos" },
   { icon: Building2, label: "Contas" },
   { icon: BarChart2, label: "Relatórios" },
   { icon: Upload, label: "Importar extrato" },
];

function ChatPage() {
   const [value, setValue] = useState("");

   return (
      <div className="relative flex h-full flex-col items-center justify-center gap-8">
         <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/8 blur-3xl" />
         </div>

         <div className="flex flex-col items-center gap-2 text-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
               <BotMessageSquare className="size-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Como posso te ajudar?</h1>
            <p className="text-sm italic text-muted-foreground">
               Gerencie suas finanças com inteligência.
            </p>
         </div>

         <div className="w-full max-w-2xl">
            <div className="rounded-xl border bg-card shadow-sm">
               <Textarea
                  className="min-h-[100px] resize-none border-0 bg-transparent p-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Faça uma pergunta ou / para comandos"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                     }
                  }}
               />
               <div className="flex items-center justify-between px-4 pb-4">
                  <span className="text-xs text-muted-foreground">
                     Rubi · Montte
                  </span>
                  <Button
                     aria-label="Enviar"
                     className="size-8"
                     disabled={!value.trim()}
                     size="icon"
                  >
                     <ArrowRight />
                  </Button>
               </div>
            </div>
         </div>

         <div className="flex max-w-xl flex-wrap justify-center gap-2">
            {QUICK_ACTIONS.map(({ icon: Icon, label }) => (
               <Button
                  key={label}
                  className="gap-2 rounded-full"
                  size="sm"
                  variant="outline"
                  onClick={() => setValue(label)}
               >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
               </Button>
            ))}
         </div>
      </div>
   );
}
