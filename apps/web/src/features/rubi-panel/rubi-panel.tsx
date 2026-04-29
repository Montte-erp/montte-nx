import { Button } from "@packages/ui/components/button";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelFooter,
   ContextPanelHeader,
   ContextPanelHeaderActions,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Textarea } from "@packages/ui/components/textarea";
import { Link } from "@tanstack/react-router";
import {
   ArrowRight,
   AtSign,
   Briefcase,
   Check,
   ChevronDown,
   Contact,
   FolderTree,
   Gauge,
   Maximize2,
   Sparkles,
   Tag,
   Wallet,
} from "lucide-react";
import { useState } from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { RubiMascotIcon } from "./rubi-mascot-icon";

const SCOPES = [
   { id: "auto", label: "Auto", icon: Sparkles },
   { id: "servicos", label: "Serviços", icon: Briefcase },
   { id: "contatos", label: "Contatos", icon: Contact },
   { id: "categorias", label: "Centro de Custo", icon: FolderTree },
   { id: "estoque", label: "Estoque", icon: Tag },
   { id: "financeiro", label: "Financeiro", icon: Wallet },
   { id: "analises", label: "Análises", icon: Gauge },
];

const SUGGESTIONS = [
   { icon: Briefcase, label: "Serviços" },
   { icon: Contact, label: "Contatos" },
   { icon: Wallet, label: "Financeiro" },
   { icon: FolderTree, label: "Centro de Custo" },
   { icon: Tag, label: "Estoque" },
   { icon: Gauge, label: "Análises" },
];

const RECENT = [
   { title: "Configurar catálogo de serviços inicial", days: 2 },
   { title: "Migrar contatos da planilha", days: 8 },
   { title: "Criar funil de receita por cliente", days: 21 },
];

export function RubiPanel() {
   const [value, setValue] = useState("");
   const [scopeOpen, setScopeOpen] = useState(false);
   const [selectedScope, setSelectedScope] = useState(SCOPES[0]);
   const { slug, teamSlug } = useDashboardSlugs();

   return (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Montte AI</ContextPanelTitle>
            <ContextPanelHeaderActions>
               <Button
                  aria-label="Abrir em tela cheia"
                  asChild
                  size="icon"
                  variant="ghost"
                  className="size-7"
               >
                  <Link
                     params={{ slug, teamSlug }}
                     search={(prev) => prev}
                     to="/$slug/$teamSlug/chat"
                  >
                     <Maximize2 className="size-4" />
                  </Link>
               </Button>
            </ContextPanelHeaderActions>
         </ContextPanelHeader>

         <ContextPanelContent className="items-center pt-4">
            <RubiMascotIcon className="size-12" />
            <div className="flex flex-col items-center gap-2 text-center">
               <h1 className="text-lg font-semibold">Como posso te ajudar?</h1>
               <p className="text-xs italic text-muted-foreground">
                  Gerencie seu negócio com inteligência.
               </p>
            </div>

            <div className="w-full rounded-xl border bg-background">
               <Textarea
                  aria-label="Mensagem para o Montte AI"
                  className="min-h-[80px] resize-none border-0 bg-transparent px-4 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Faça uma pergunta ou / para comandos"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                     }
                  }}
               />
               <div className="flex items-center justify-between gap-2 px-2 pb-2">
                  <div className="flex items-center gap-2">
                     <Popover open={scopeOpen} onOpenChange={setScopeOpen}>
                        <PopoverTrigger asChild>
                           <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-2 rounded-full px-2 text-xs font-normal text-muted-foreground"
                           >
                              {selectedScope ? (
                                 <selectedScope.icon className="size-4" />
                              ) : null}
                              {selectedScope?.label}
                              <ChevronDown className="size-4" />
                           </Button>
                        </PopoverTrigger>
                        <PopoverContent
                           align="start"
                           className="w-44 p-2"
                           sideOffset={4}
                        >
                           {SCOPES.map((scope) => (
                              <Button
                                 key={scope.id}
                                 variant="ghost"
                                 className="flex w-full items-center justify-start gap-2 rounded-sm px-2 py-2 text-xs"
                                 onClick={() => {
                                    setSelectedScope(scope);
                                    setScopeOpen(false);
                                 }}
                              >
                                 <scope.icon className="size-4 text-muted-foreground" />
                                 <span>{scope.label}</span>
                                 {selectedScope?.id === scope.id ? (
                                    <Check className="size-4 text-primary" />
                                 ) : null}
                              </Button>
                           ))}
                        </PopoverContent>
                     </Popover>

                     <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-2 rounded-full px-2 text-xs font-normal text-muted-foreground"
                     >
                        <AtSign className="size-4" />
                        Adicionar contexto
                        <ChevronDown className="size-4" />
                     </Button>
                  </div>

                  <Button
                     aria-label="Enviar"
                     className="size-8 rounded-md"
                     disabled={!value.trim()}
                     size="icon"
                  >
                     <ArrowRight />
                  </Button>
               </div>
            </div>

            <div className="flex flex-col items-center gap-2">
               <p className="text-xs text-muted-foreground">
                  Tente o Montte AI para...
               </p>
               <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map(({ icon: Icon, label }) => (
                     <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-2 rounded-full px-2 text-xs font-normal"
                        onClick={() =>
                           setValue(`Me ajude com ${label.toLowerCase()}`)
                        }
                     >
                        <Icon className="size-4" />
                        {label}
                     </Button>
                  ))}
               </div>
            </div>
         </ContextPanelContent>

         <ContextPanelFooter>
            <div className="flex items-center justify-between pb-2">
               <span className="text-xs text-muted-foreground">
                  Conversas recentes
               </span>
               <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground"
               >
                  Ver todas
               </Button>
            </div>
            <ul className="flex flex-col gap-2">
               {RECENT.map((chat) => (
                  <li
                     key={chat.title}
                     className="flex items-center justify-between gap-2 text-xs"
                  >
                     <button
                        type="button"
                        className="flex-1 truncate text-left text-foreground hover:underline"
                     >
                        {chat.title}
                     </button>
                     <span className="shrink-0 text-muted-foreground">
                        {chat.days}d
                     </span>
                  </li>
               ))}
            </ul>
         </ContextPanelFooter>
      </ContextPanel>
   );
}
