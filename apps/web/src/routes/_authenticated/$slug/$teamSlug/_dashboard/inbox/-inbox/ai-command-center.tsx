import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { toast } from "@packages/ui/hooks/use-toast";
import { Link } from "@tanstack/react-router";
import { useClipboard } from "foxact/use-clipboard";
import {
   AlertTriangle,
   ArrowRight,
   Bot,
   Clipboard,
   FileCheck2,
   Gauge,
   Package,
   ReceiptText,
   Sparkles,
   WalletCards,
   type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { cn } from "@packages/ui/lib/utils";
import {
   deriveContractCharges,
   formatCurrency,
   getContractPartyName,
   initialContracts,
   initialCustomers,
   initialSuppliers,
   useDemoContracts,
   useDemoCustomers,
   useDemoSuppliers,
} from "../../-local-first-demo/demo-data";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";

type SignalSeverity = "critical" | "warning" | "info";
type SignalRoute = "chat" | "transactions" | "produtos" | "nfe" | "contratos";

interface DemoSignal {
   id: string;
   title: string;
   description: string;
   severity: SignalSeverity;
   impact: string;
   icon: LucideIcon;
   route: SignalRoute;
   actionLabel: string;
   prompt: string;
   evidence: string[];
}

const SEVERITY_LABEL: Record<SignalSeverity, string> = {
   critical: "Revisar agora",
   warning: "Atenção",
   info: "Monitorar",
};

const SEVERITY_CLASS: Record<SignalSeverity, string> = {
   critical: "border-destructive/40 bg-destructive/5",
   warning:
      "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20",
   info: "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/20",
};

const PRODUCT_EVIDENCE = [
   "Filtro de papel: 8 un. em estoque, mínimo 10",
   "Camiseta evento: 5 un. em estoque, mínimo 8",
];

const NFE_EVIDENCE = [
   "NF-e 1049 rejeitada: emissor não habilitado",
   "NF-e 1050 aguardando processamento",
   "NF-e 1051 em contingência EPEC",
];

export function AiCommandCenter() {
   const { slug, teamSlug } = useDashboardSlugs();
   const [contracts] = useDemoContracts();
   const [customers] = useDemoCustomers();
   const [suppliers] = useDemoSuppliers();
   const { copy } = useClipboard({ timeout: 1800 });

   const data = useMemo(
      () => ({
         contracts: contracts ?? initialContracts,
         customers: customers ?? initialCustomers,
         suppliers: suppliers ?? initialSuppliers,
      }),
      [contracts, customers, suppliers],
   );

   const signals = useMemo(() => buildSignals(data), [data]);
   const reviewCount = signals.filter(
      (signal) =>
         signal.severity === "critical" || signal.severity === "warning",
   ).length;
   const evidenceCount = signals.reduce(
      (total, signal) => total + signal.evidence.length,
      0,
   );

   function handleCopyPrompt(prompt: string) {
      copy(prompt);
      toast.success("Prompt copiado para a Montte AI.");
   }

   return (
      <section className="flex flex-col gap-4">
         <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-1">
               <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-muted-foreground text-sm font-medium">
                     Centro de comando IA
                  </span>
               </div>
               <h2 className="text-xl font-semibold tracking-normal">
                  Sinais operacionais com evidência
               </h2>
               <p className="text-muted-foreground max-w-3xl text-sm">
                  A demo cruza financeiro, contratos, estoque e NF-e para
                  destacar o que precisa de revisão antes do fechamento.
               </p>
            </div>
            <div className="grid grid-cols-3 gap-2 md:w-[28rem]">
               <Metric label="sinais" value={String(signals.length)} />
               <Metric label="revisões" value={String(reviewCount)} />
               <Metric label="evidências" value={String(evidenceCount)} />
            </div>
         </div>

         <div className="grid gap-4 xl:grid-cols-3">
            {signals.map((signal) => (
               <Card
                  className={cn(
                     "flex min-h-80 flex-col border",
                     SEVERITY_CLASS[signal.severity],
                  )}
                  key={signal.id}
               >
                  <CardHeader className="gap-3">
                     <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                           <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                              <signal.icon className="size-4" />
                           </span>
                           <Badge variant="secondary">
                              {SEVERITY_LABEL[signal.severity]}
                           </Badge>
                        </div>
                        <span className="text-right text-xs font-medium text-muted-foreground">
                           {signal.impact}
                        </span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <CardTitle className="text-base">
                           {signal.title}
                        </CardTitle>
                        <CardDescription>{signal.description}</CardDescription>
                     </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                     <div className="flex flex-col gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                           Evidências usadas
                        </span>
                        <ul className="flex flex-col gap-2 text-sm">
                           {signal.evidence.map((item) => (
                              <li className="flex gap-2" key={item}>
                                 <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                                 <span>{item}</span>
                              </li>
                           ))}
                        </ul>
                     </div>
                     <div className="mt-auto flex flex-col gap-3 rounded-md border bg-background p-3">
                        <span className="text-xs font-medium text-muted-foreground">
                           Prompt sugerido
                        </span>
                        <p className="text-sm">{signal.prompt}</p>
                        <div className="flex flex-wrap gap-2">
                           <Button
                              className="gap-2"
                              onClick={() => handleCopyPrompt(signal.prompt)}
                              size="sm"
                              type="button"
                              variant="outline"
                           >
                              <Clipboard className="size-4" />
                              Copiar
                           </Button>
                           <SignalLink
                              label={signal.actionLabel}
                              route={signal.route}
                              slug={slug}
                              teamSlug={teamSlug}
                           />
                        </div>
                     </div>
                  </CardContent>
               </Card>
            ))}
         </div>
      </section>
   );
}

function Metric({ label, value }: { label: string; value: string }) {
   return (
      <div className="rounded-md border bg-background p-3">
         <div className="text-lg font-semibold leading-none">{value}</div>
         <div className="text-muted-foreground text-xs">{label}</div>
      </div>
   );
}

function SignalLink({
   label,
   route,
   slug,
   teamSlug,
}: {
   label: string;
   route: SignalRoute;
   slug: string;
   teamSlug: string;
}) {
   const content = (
      <>
         {label}
         <ArrowRight className="size-4" />
      </>
   );

   if (route === "chat")
      return (
         <Button asChild className="gap-2" size="sm">
            <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/chat">
               {content}
            </Link>
         </Button>
      );

   if (route === "transactions")
      return (
         <Button asChild className="gap-2" size="sm">
            <Link
               params={{ slug, teamSlug }}
               to="/$slug/$teamSlug/transactions"
            >
               {content}
            </Link>
         </Button>
      );

   if (route === "produtos")
      return (
         <Button asChild className="gap-2" size="sm">
            <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/produtos">
               {content}
            </Link>
         </Button>
      );

   if (route === "nfe")
      return (
         <Button asChild className="gap-2" size="sm">
            <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/nfe">
               {content}
            </Link>
         </Button>
      );

   return (
      <Button asChild className="gap-2" size="sm">
         <Link params={{ slug, teamSlug }} to="/$slug/$teamSlug/contratos">
            {content}
         </Link>
      </Button>
   );
}

function buildSignals(data: {
   contracts: typeof initialContracts;
   customers: typeof initialCustomers;
   suppliers: typeof initialSuppliers;
}): DemoSignal[] {
   const receivable = data.contracts.find(
      (contract) =>
         contract.direction === "receita" && contract.status === "active",
   );
   const payable = data.contracts.find(
      (contract) =>
         contract.direction === "despesa" && contract.status === "active",
   );
   const overdueCharge = receivable
      ? deriveContractCharges(receivable).find(
           (charge) => charge.status === "atrasada",
        )
      : undefined;
   const openPayable = payable
      ? deriveContractCharges(payable).find(
           (charge) => charge.status === "em_aberto",
        )
      : undefined;
   const receivableParty = receivable
      ? getContractPartyName({
           contract: receivable,
           customers: data.customers,
           suppliers: data.suppliers,
        })
      : "Cliente recorrente";
   const payableParty = payable
      ? getContractPartyName({
           contract: payable,
           customers: data.customers,
           suppliers: data.suppliers,
        })
      : "Fornecedor recorrente";
   const overdueAmount =
      overdueCharge && receivable
         ? formatCurrency(overdueCharge.amount)
         : "R$ 0,00";
   const payableAmount =
      openPayable && payable ? formatCurrency(openPayable.amount) : "R$ 0,00";

   return [
      {
         id: "receivables-risk",
         title: "Recebível recorrente precisa de cobrança",
         description:
            "A IA encontrou cobrança atrasada em contrato ativo e separou os dados necessários para abordagem.",
         severity: "critical",
         impact: overdueAmount,
         icon: WalletCards,
         route: "contratos",
         actionLabel: "Ver contratos",
         prompt: `Explique o risco de recebimento do contrato ${receivable?.number ?? "recorrente"} e sugira uma cobrança objetiva para ${receivableParty}.`,
         evidence: [
            `${receivable?.number ?? "Contrato ativo"}: ${receivable?.title ?? "receita recorrente"}`,
            `${receivableParty}: parcela ${overdueCharge?.competence ?? "06/2026"} em atraso`,
            `Valor em aberto: ${overdueAmount}`,
         ],
      },
      {
         id: "payables-review",
         title: "Despesa recorrente entra no fechamento",
         description:
            "A IA marcou fornecedor ativo com pagamento em aberto para evitar surpresa no caixa projetado.",
         severity: "warning",
         impact: payableAmount,
         icon: ReceiptText,
         route: "transactions",
         actionLabel: "Ver financeiro",
         prompt: `Revise a despesa recorrente de ${payableParty} e diga se ela deve entrar no fechamento deste mês.`,
         evidence: [
            `${payable?.number ?? "Contrato ativo"}: ${payable?.title ?? "serviço recorrente"}`,
            `${payableParty}: vencimento previsto para ${openPayable?.dueDate ?? "2026-06-08"}`,
            `Impacto no caixa: ${payableAmount}`,
         ],
      },
      {
         id: "inventory-reorder",
         title: "Estoque abaixo do mínimo",
         description:
            "Produtos físicos da demo ficaram abaixo do nível mínimo e já podem virar tarefa de reposição.",
         severity: "warning",
         impact: "2 itens",
         icon: Package,
         route: "produtos",
         actionLabel: "Ver estoque",
         prompt:
            "Liste os produtos abaixo do mínimo, estime prioridade de reposição e gere uma recomendação curta de compra.",
         evidence: PRODUCT_EVIDENCE,
      },
      {
         id: "fiscal-exceptions",
         title: "NF-e com exceções fiscais",
         description:
            "A IA agrupou rejeição, processamento e contingência para revisão antes de faturamento seguir.",
         severity: "critical",
         impact: "3 notas",
         icon: FileCheck2,
         route: "nfe",
         actionLabel: "Ver NF-e",
         prompt:
            "Priorize as NF-e pendentes, explique o risco de cada status e indique a próxima ação operacional.",
         evidence: NFE_EVIDENCE,
      },
      {
         id: "expense-flux",
         title: "Variação de despesas merece explicação",
         description:
            "A demo destaca uma leitura de variação para mostrar análise financeira pronta para reunião.",
         severity: "info",
         impact: "+42%",
         icon: Gauge,
         route: "chat",
         actionLabel: "Abrir Montte AI",
         prompt:
            "Faça uma análise de variação das despesas do mês, cite os lançamentos que explicam a alta e escreva um resumo para gestão.",
         evidence: [
            "Infraestrutura concentrou a maior alta do período",
            "Cloudbox aparece como fornecedor recorrente relevante",
            "Revisão indicada antes do fechamento mensal",
         ],
      },
      {
         id: "close-check",
         title: "Checklist de fechamento sugerido",
         description:
            "A IA combina exceções fiscais, caixa, contratos e estoque em uma fila curta de revisão.",
         severity: "info",
         impact: "4 etapas",
         icon: Bot,
         route: "chat",
         actionLabel: "Abrir Montte AI",
         prompt:
            "Monte um checklist de fechamento para esta demo com cobrança, despesa recorrente, NF-e pendente e estoque baixo.",
         evidence: [
            "Contratos recorrentes com cobrança e despesa",
            "NF-e rejeitada, processando e em contingência",
            "Produtos abaixo do mínimo operacional",
         ],
      },
   ];
}
