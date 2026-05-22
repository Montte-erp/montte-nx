import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { toast } from "@packages/ui/hooks/use-toast";
import { cn } from "@packages/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useClipboard } from "foxact/use-clipboard";
import {
   AlertCircle,
   AlertTriangle,
   ArrowRight,
   Bot,
   Clock,
   Clipboard,
   FileCheck2,
   Gauge,
   Info,
   Package,
   ReceiptText,
   WalletCards,
   type LucideIcon,
} from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
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
import type { InboxSeverityFilter } from "./inbox-filters";

type SignalSeverity = "critical" | "warning" | "info";
type SignalRoute = "chat" | "transactions" | "produtos" | "nfe" | "contratos";

interface DemoSignal {
   id: string;
   title: string;
   description: string;
   severity: SignalSeverity;
   source: string;
   age: string;
   impact: string;
   icon: LucideIcon;
   route: SignalRoute;
   actionLabel: string;
   prompt: string;
   evidence: string[];
}

const SEVERITY_BADGE: Record<
   SignalSeverity,
   { label: string; variant: "destructive" | "default" | "secondary" }
> = {
   critical: { label: "Urgente", variant: "destructive" },
   warning: { label: "Aviso", variant: "default" },
   info: { label: "Info", variant: "secondary" },
};

const SEVERITY_ICON: Record<SignalSeverity, LucideIcon> = {
   critical: AlertCircle,
   warning: AlertTriangle,
   info: Info,
};

const SEVERITY_ICON_CLASS: Record<SignalSeverity, string> = {
   critical: "text-destructive",
   warning: "text-amber-500",
   info: "text-sky-500",
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

interface InboxSuggestedSignalsProps {
   fallback?: ReactNode;
   severity: InboxSeverityFilter;
}

export function InboxSuggestedSignals({
   fallback,
   severity,
}: InboxSuggestedSignalsProps) {
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
   const visibleSignals = signals.filter((signal) =>
      shouldShowSignal({ filter: severity, signal }),
   );

   function handleCopyPrompt(prompt: string) {
      copy(prompt);
      toast.success("Prompt copiado para a Montte AI.");
   }

   if (visibleSignals.length === 0) return fallback;

   return (
      <>
         {visibleSignals.map((signal) => (
            <SignalInboxItem
               key={signal.id}
               onCopyPrompt={handleCopyPrompt}
               signal={signal}
               slug={slug}
               teamSlug={teamSlug}
            />
         ))}
      </>
   );
}

function shouldShowSignal({
   filter,
   signal,
}: {
   filter: InboxSeverityFilter;
   signal: DemoSignal;
}) {
   if (filter === "all") return true;
   if (filter === "urgent") return signal.severity === "critical";
   return signal.severity === filter;
}

function SignalInboxItem({
   onCopyPrompt,
   signal,
   slug,
   teamSlug,
}: {
   onCopyPrompt: (prompt: string) => void;
   signal: DemoSignal;
   slug: string;
   teamSlug: string;
}) {
   const SeverityIcon = SEVERITY_ICON[signal.severity];
   const badge = SEVERITY_BADGE[signal.severity];

   return (
      <article className="rounded-lg border bg-card text-card-foreground shadow-sm">
         <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <SeverityIcon
               className={cn(
                  "size-5 shrink-0",
                  SEVERITY_ICON_CLASS[signal.severity],
               )}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
               <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <Badge className="gap-1" variant="outline">
                     <Bot className="size-3" />
                     Sugerido
                  </Badge>
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
                     <Clock className="size-3" />
                     {signal.age}
                  </span>
                  <span className="text-muted-foreground text-xs">
                     {signal.source}
                  </span>
               </div>

               <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold leading-tight">
                     {signal.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                     {signal.description}
                  </p>
               </div>

               <div className="flex flex-wrap gap-2">
                  {signal.evidence.slice(0, 3).map((item) => (
                     <span
                        className="rounded-md border bg-muted/30 px-2 py-1 text-xs"
                        key={item}
                     >
                        {item}
                     </span>
                  ))}
               </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
               <Button
                  className="gap-2"
                  onClick={() => onCopyPrompt(signal.prompt)}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  <Clipboard className="size-4" />
                  Copiar prompt
               </Button>
               <SignalLink
                  label={signal.actionLabel}
                  route={signal.route}
                  slug={slug}
                  teamSlug={teamSlug}
               />
            </div>
         </div>
      </article>
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
         title: "Cobrança recorrente atrasada",
         description:
            "Contrato ativo tem parcela vencida e já traz o contexto para cobrança objetiva.",
         severity: "critical",
         source: "Contratos e financeiro",
         age: "agora",
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
         title: "Despesa entra no fechamento",
         description:
            "Fornecedor recorrente aparece em aberto e pode mudar a leitura do caixa projetado.",
         severity: "warning",
         source: "Fornecedores e transações",
         age: "11min",
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
            "Itens físicos ficaram abaixo do nível mínimo e pedem reposição antes da próxima venda.",
         severity: "warning",
         source: "Produtos",
         age: "1h",
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
            "Rejeição, processamento e contingência foram agrupados para revisão de faturamento.",
         severity: "critical",
         source: "NF-e",
         age: "2h",
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
         title: "Variação de despesas",
         description:
            "Leitura pronta para explicar a alta de despesas antes da reunião de gestão.",
         severity: "info",
         source: "Análise financeira",
         age: "3h",
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
         title: "Checklist de fechamento",
         description:
            "Fila curta combina cobrança, despesa recorrente, NF-e pendente e estoque baixo.",
         severity: "info",
         source: "Montte AI",
         age: "ontem",
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
