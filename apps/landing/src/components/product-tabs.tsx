import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";

const tabs = [
   {
      id: "financeiro",
      label: "financeiro.ts",
      title: "Financeiro que se concilia sozinho",
      desc: "Importe extratos OFX, conecte Pix, deixe a Rubi categorizar tudo. Você revisa apenas o que importa.",
      cta: "Ver módulo financeiro",
      code: `import { reconcile } from "@montte/finance";
import { rubi } from "@montte/rubi";

const ofx = await readOFX("./extrato.ofx");

const result = await reconcile({
   ofx,
   account: "itau-001",
   classifier: rubi.categorize,
});

console.log(result.matched, "transações conciliadas");
console.log(result.review.length, "para revisar");`,
   },
   {
      id: "contatos",
      label: "contatos.ts",
      title: "CRM construído para o Brasil",
      desc: "CPF, CNPJ, segmentação por centro de custo, importação CSV/XLSX e busca BM25.",
      cta: "Ver módulo contatos",
      code: `import { contacts } from "@montte/crm";

await contacts.import({
   file: "./clientes.csv",
   mapping: {
      cpfCnpj: "documento",
      name: "razao_social",
      tags: "centro_custo",
   },
   dedupeBy: "cpfCnpj",
});`,
   },
   {
      id: "servicos",
      label: "servicos.ts",
      title: "Cobrança baseada em uso",
      desc: "Crie planos com medidores, addons e descontos. Faturamento automático no fim do período.",
      cta: "Ver módulo serviços",
      code: `import { meters, services } from "@montte/billing";

const plan = await services.createPlan({
   name: "Pro",
   items: [
      { meter: meters.aiCalls, price: "0.012 BRL" },
      { meter: meters.storage, price: "0.49 BRL/GB" },
   ],
   trialDays: 14,
});`,
   },
   {
      id: "rubi",
      label: "rubi.ts",
      title: "A agente que opera o ERP",
      desc: "Não é chatbot grudado depois. A Rubi enxerga seus dados, sugere e executa quando você autoriza.",
      cta: "Ver Rubi IA",
      code: `import { rubi } from "@montte/rubi";

const answer = await rubi.ask({
   thread: "team-finance",
   prompt: "Quanto gastei com fornecedores em abril?",
   context: { teamId, period: "2026-04" },
});

await answer.execute({ requireApproval: true });`,
   },
];

export function ProductTabs() {
   return (
      <Tabs defaultValue={tabs[0].id} className="gap-0">
         <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none rounded-t-2xl border border-b-0 border-border/60 bg-card/40 p-0 backdrop-blur"
         >
            {tabs.map((t) => (
               <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="relative h-11 shrink-0 rounded-none border-r border-border/40 bg-transparent px-5 font-mono text-xs font-medium text-muted-foreground data-[state=active]:bg-background/60 data-[state=active]:text-foreground data-[state=active]:shadow-none"
               >
                  {t.label}
               </TabsTrigger>
            ))}
         </TabsList>

         {tabs.map((t) => (
            <TabsContent
               key={t.id}
               value={t.id}
               className="m-0 overflow-hidden rounded-b-2xl border border-border/60 bg-card/40 backdrop-blur"
            >
               <div className="grid gap-0 lg:grid-cols-2">
                  <div className="flex flex-col justify-between gap-8 border-b border-border/60 p-8 lg:border-r lg:border-b-0 lg:p-12">
                     <div className="flex flex-col gap-4">
                        <h3 className="text-3xl font-semibold tracking-[-0.02em] text-foreground text-balance sm:text-4xl">
                           {t.title}
                        </h3>
                        <p className="text-base leading-relaxed text-muted-foreground">
                           {t.desc}
                        </p>
                     </div>
                     <a
                        href="#"
                        className="group inline-flex h-11 w-fit items-center gap-2 rounded-full border border-border/60 bg-background/80 px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-background"
                     >
                        {t.cta}
                        <svg
                           className="size-3.5 transition-transform group-hover:translate-x-0.5"
                           viewBox="0 0 24 24"
                           fill="none"
                           stroke="currentColor"
                           strokeWidth="2.5"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                        >
                           <path d="M5 12h14M13 5l7 7-7 7" />
                        </svg>
                     </a>
                  </div>

                  <pre className="relative m-0 overflow-x-auto bg-background/40 p-6 font-mono text-[13px] leading-relaxed text-foreground/90 lg:p-8">
                     <code>
                        {t.code.split("\n").map((line, i) => (
                           <div key={i} className="flex gap-4">
                              <span className="w-6 shrink-0 text-right text-muted-foreground/50 select-none">
                                 {i + 1}
                              </span>
                              <span className="flex-1 whitespace-pre">
                                 {line || " "}
                              </span>
                           </div>
                        ))}
                     </code>
                  </pre>
               </div>
            </TabsContent>
         ))}
      </Tabs>
   );
}
