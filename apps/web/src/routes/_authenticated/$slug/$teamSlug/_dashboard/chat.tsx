import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Textarea } from "@packages/ui/components/textarea";
import { createFileRoute } from "@tanstack/react-router";
import {
   ArrowRight,
   BarChart2,
   Building2,
   Check,
   ChevronDown,
   CreditCard,
   FileText,
   Layers,
   Package,
   Tag,
   TrendingUp,
   Users,
   Wallet,
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

const SCOPES = [
   { id: "auto", label: "Auto", icon: Layers },
   { id: "financas", label: "Finanças", icon: TrendingUp },
   { id: "contatos", label: "Contatos", icon: Users },
   { id: "categorias", label: "Categorias", icon: Tag },
   { id: "estoque", label: "Estoque", icon: Package },
   { id: "relatorios", label: "Relatórios", icon: BarChart2 },
   { id: "contas", label: "Contas", icon: Building2 },
   { id: "cartoes", label: "Cartões", icon: CreditCard },
];

const QUICK_PROMPTS = [
   { icon: TrendingUp, label: "Qual foi meu gasto esse mês?" },
   { icon: Tag, label: "Em qual categoria gastei mais?" },
   { icon: Wallet, label: "Como está meu fluxo de caixa?" },
   { icon: FileText, label: "Quais contas vencem essa semana?" },
   { icon: Users, label: "Clientes com faturas em aberto" },
   { icon: BarChart2, label: "Compare receitas e despesas" },
];

function ChatPage() {
   const [value, setValue] = useState("");
   const [scopeOpen, setScopeOpen] = useState(false);
   const [selectedScope, setSelectedScope] = useState(SCOPES[0]);

   return (
      <div className="relative flex h-full flex-col items-center justify-center gap-8">
         <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/8 blur-3xl" />
         </div>

         <div className="flex flex-col items-center gap-2 text-center">
            <img
               src="/mascot.svg"
               alt="Rubi"
               className="mb-2 size-14 drop-shadow-sm"
            />
            <h1 className="text-2xl font-semibold">Como posso te ajudar?</h1>
            <p className="text-sm italic text-muted-foreground">
               Gerencie suas finanças com inteligência.
            </p>
         </div>

         <div className="w-full max-w-4xl">
            <div className="rounded-xl border bg-card">
               <Textarea
                  className="min-h-[100px] resize-none border-0 bg-transparent p-4 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Faça uma pergunta..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                     }
                  }}
               />
               <div className="flex items-center justify-between px-3 pb-3">
                  <div className="flex items-center gap-1">
                     <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
                        <PopoverTrigger asChild>
                           <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                           >
                              <selectedScope.icon className="size-3.5" />
                              {selectedScope.label}
                              <ChevronDown className="size-3" />
                           </Button>
                        </PopoverTrigger>
                        <PopoverContent
                           align="start"
                           className="w-44 p-1"
                           sideOffset={4}
                        >
                           {SCOPES.map((scope) => (
                              <button
                                 key={scope.id}
                                 type="button"
                                 className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                                 onClick={() => {
                                    setSelectedScope(scope);
                                    setScopeOpen(false);
                                 }}
                              >
                                 <scope.icon className="size-3.5 text-muted-foreground" />
                                 <span>{scope.label}</span>
                                 {selectedScope.id === scope.id && (
                                    <Check className="ml-auto size-3 text-primary" />
                                 )}
                              </button>
                           ))}
                        </PopoverContent>
                     </Popover>
                  </div>

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

         <div className="flex max-w-2xl flex-wrap justify-center gap-2">
            {QUICK_PROMPTS.map(({ icon: Icon, label }) => (
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
