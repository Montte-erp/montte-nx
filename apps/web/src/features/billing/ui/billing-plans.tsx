import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import {
   Briefcase,
   Check,
   Coins,
   CreditCard,
   Package,
   Sparkles,
   Users,
   Webhook,
   Zap,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const BILLABLE_EVENTS = [
   {
      icon: <Coins className="size-4" />,
      category: "Finanças",
      name: "Transação criada",
      freeLimit: "500/mês",
      price: "R$ 0,001",
   },
   {
      icon: <Webhook className="size-4" />,
      category: "Webhook",
      name: "Entrega de webhook",
      freeLimit: "500/mês",
      price: "R$ 0,0005",
   },
   {
      icon: <Users className="size-4" />,
      category: "Contatos",
      name: "Contato criado",
      freeLimit: "50/mês",
      price: "R$ 0,01",
   },
   {
      icon: <Package className="size-4" />,
      category: "Estoque",
      name: "Item criado",
      freeLimit: "50/mês",
      price: "R$ 0,01",
   },
   {
      icon: <Briefcase className="size-4" />,
      category: "Serviços",
      name: "Serviço criado",
      freeLimit: "20/mês",
      price: "R$ 0,01",
   },
];

const ADDONS = [
   {
      id: "boost",
      icon: <Zap className="size-5" />,
      label: "Boost",
      price: "R$ 199",
      period: "/mês",
      description:
         "Para times que precisam de controles avançados de identidade e personalização.",
      features: [
         "SSO (Single Sign-On)",
         "White label (marca própria)",
         "2FA enforcement para toda a organização",
         "Espaços ilimitados",
      ],
   },
   {
      id: "scale",
      icon: <Sparkles className="size-5" />,
      label: "Scale",
      price: "R$ 599",
      period: "/mês",
      description:
         "Tudo do Boost, mais governança empresarial e suporte prioritário.",
      features: [
         "Tudo do Boost",
         "SAML 2.0",
         "RBAC (controle de acesso por função)",
         "Audit logs completos",
         "SLA de resposta em 24h",
      ],
      highlight: true,
   },
   {
      id: "enterprise",
      icon: <CreditCard className="size-5" />,
      label: "Enterprise",
      price: "R$ 2.500+",
      period: "/mês",
      description:
         "Para empresas com estrutura multi-CNPJ, suporte dedicado e SLA crítico.",
      features: [
         "Tudo do Scale",
         "Múltiplos CNPJs na mesma conta",
         "SLA de resposta em 4h",
         "Gerente de conta dedicado",
         "Onboarding assistido",
      ],
   },
];

type ActiveAddon = { addonId: string };

function AddonCards() {
   const { activeOrganization } = useActiveOrganization();
   const { data: activeAddons } = useQuery(
      orpc.organization.getAddons.queryOptions({}),
   );
   const { data: paymentStatus } = useQuery(
      orpc.billing.getPaymentStatus.queryOptions({}),
   );
   const [isPending, startTransition] = useTransition();

   const activeAddonIds = new Set(
      (activeAddons ?? []).map((a: ActiveAddon) => a.addonId),
   );
   const hasPaymentMethod = paymentStatus?.hasPaymentMethod ?? false;

   const handleSubscribe = () => {
      startTransition(async () => {
         const result = await authClient.subscription.billingPortal({
            referenceId: activeOrganization?.id,
            returnUrl: window.location.href,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao abrir portal");
            return;
         }
         if (result.data?.url) {
            window.location.href = result.data.url;
         }
      });
   };

   return (
      <div className="grid gap-4 md:grid-cols-3">
         {ADDONS.map((addon) => {
            const isActive = activeAddonIds.has(addon.id);
            return (
               <Card
                  className={
                     addon.highlight ? "border-primary ring-1 ring-primary" : ""
                  }
                  key={addon.id}
               >
                  <CardHeader className="pb-3">
                     {addon.highlight && (
                        <Badge className="mb-2 w-fit" variant="default">
                           Mais popular
                        </Badge>
                     )}
                     <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                           {addon.icon}
                        </div>
                        <CardTitle className="text-base">
                           {addon.label}
                        </CardTitle>
                        {isActive && (
                           <Badge
                              className="bg-primary/10 text-primary border-primary/20"
                              variant="secondary"
                           >
                              Ativo
                           </Badge>
                        )}
                     </div>
                     <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">
                           {addon.price}
                        </span>
                        <span className="text-sm text-muted-foreground">
                           {addon.period}
                        </span>
                     </div>
                     <CardDescription className="text-xs">
                        {addon.description}
                     </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <ul className="space-y-2">
                        {addon.features.map((feature) => (
                           <li
                              className="flex items-start gap-2 text-sm"
                              key={feature}
                           >
                              <Check className="size-4 shrink-0 text-primary mt-0.5" />
                              <span>{feature}</span>
                           </li>
                        ))}
                     </ul>
                     {!isActive && (
                        <Button
                           className="w-full"
                           disabled={!hasPaymentMethod || isPending}
                           onClick={handleSubscribe}
                           size="sm"
                           variant={addon.highlight ? "default" : "outline"}
                        >
                           {addon.id === "enterprise"
                              ? "Falar com vendas"
                              : "Assinar"}
                        </Button>
                     )}
                     {isActive && (
                        <Button
                           className="w-full"
                           onClick={handleSubscribe}
                           size="sm"
                           variant="outline"
                        >
                           Gerenciar
                        </Button>
                     )}
                  </CardContent>
               </Card>
            );
         })}
      </div>
   );
}

function FreeTierSection() {
   return (
      <Card>
         <CardHeader>
            <div className="flex items-center justify-between">
               <div>
                  <CardTitle className="text-base">Pay as you go</CardTitle>
                  <CardDescription className="text-xs mt-1">
                     Comece de graça. Pague apenas pelo que usar acima dos
                     limites mensais.
                  </CardDescription>
               </div>
               <Badge variant="outline">Gratuito para começar</Badge>
            </div>
         </CardHeader>
         <CardContent>
            <Table>
               <TableHeader>
                  <TableRow>
                     <TableHead>Evento</TableHead>
                     <TableHead>Categoria</TableHead>
                     <TableHead>Limite gratuito</TableHead>
                     <TableHead className="text-right">
                        Preço por evento acima do limite
                     </TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {BILLABLE_EVENTS.map((event) => (
                     <TableRow key={event.name}>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                 {event.icon}
                              </span>
                              <span className="font-medium text-sm">
                                 {event.name}
                              </span>
                           </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                           {event.category}
                        </TableCell>
                        <TableCell>
                           <Badge className="font-normal" variant="secondary">
                              {event.freeLimit}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                           {event.price}
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </CardContent>
      </Card>
   );
}

export function BillingPlans() {
   return (
      <div className="space-y-8">
         <div>
            <h2 className="text-lg font-semibold mb-1">Planos e preços</h2>
            <p className="text-sm text-muted-foreground">
               Preços transparentes, sem surpresas. Sem "fale com vendas" para
               saber quanto custa.
            </p>
         </div>

         <FreeTierSection />

         <div>
            <h2 className="text-base font-semibold mb-1">Add-ons</h2>
            <p className="text-sm text-muted-foreground mb-4">
               Recursos adicionais para times que precisam de mais controle e
               suporte.
            </p>
            <AddonCards />
         </div>
      </div>
   );
}
