import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Separator } from "@packages/ui/components/separator";
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
import type { ReactNode } from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

interface ProductPricingRow {
   icon: ReactNode;
   name: string;
   description: string;
   freeLimit: string;
   pricingTiers: { label: string; price: string }[];
}

const PRODUCTS: ProductPricingRow[] = [
   {
      icon: <Coins className="size-4" />,
      name: "Finanças",
      description: "Transações, conciliações e lançamentos",
      freeLimit: "500 transações / mês",
      pricingTiers: [{ label: "Acima de 500", price: "R$ 0,001 / transação" }],
   },
   {
      icon: <Users className="size-4" />,
      name: "Contatos",
      description: "Criação e gestão de clientes e fornecedores",
      freeLimit: "50 contatos / mês",
      pricingTiers: [{ label: "Acima de 50", price: "R$ 0,01 / contato" }],
   },
   {
      icon: <Package className="size-4" />,
      name: "Estoque",
      description: "Cadastro de produtos e itens de inventário",
      freeLimit: "50 itens / mês",
      pricingTiers: [{ label: "Acima de 50", price: "R$ 0,01 / item" }],
   },
   {
      icon: <Briefcase className="size-4" />,
      name: "Serviços",
      description: "Ordens de serviço e prestação de serviços",
      freeLimit: "20 serviços / mês",
      pricingTiers: [{ label: "Acima de 20", price: "R$ 0,01 / serviço" }],
   },
   {
      icon: <Webhook className="size-4" />,
      name: "Webhooks",
      description: "Entregas de eventos para sistemas externos",
      freeLimit: "500 entregas / mês",
      pricingTiers: [{ label: "Acima de 500", price: "R$ 0,0005 / entrega" }],
   },
];

interface AddonDef {
   id: string;
   icon: ReactNode;
   label: string;
   price: string;
   period: string;
   tagline: string;
   features: string[];
   highlight?: boolean;
   ctaLabel: string;
}

const ADDONS: AddonDef[] = [
   {
      id: "boost",
      icon: <Zap className="size-4" />,
      label: "Boost",
      price: "R$ 199",
      period: "/mês",
      tagline: "Controles avançados de identidade e personalização",
      features: [
         "SSO (Single Sign-On)",
         "White label",
         "2FA enforcement",
         "Espaços ilimitados",
      ],
      ctaLabel: "Assinar Boost",
   },
   {
      id: "scale",
      icon: <Sparkles className="size-4" />,
      label: "Scale",
      price: "R$ 599",
      period: "/mês",
      tagline: "Governança empresarial e suporte prioritário",
      features: [
         "Tudo do Boost",
         "SAML 2.0",
         "RBAC avançado",
         "Audit logs",
         "SLA 24h",
      ],
      highlight: true,
      ctaLabel: "Assinar Scale",
   },
   {
      id: "enterprise",
      icon: <CreditCard className="size-4" />,
      label: "Enterprise",
      price: "R$ 2.500+",
      period: "/mês",
      tagline: "Multi-CNPJ, SLA crítico e suporte dedicado",
      features: [
         "Tudo do Scale",
         "Múltiplos CNPJs",
         "SLA 4h",
         "Gerente dedicado",
         "Onboarding assistido",
      ],
      ctaLabel: "Assinar Enterprise",
   },
];

type ActiveAddon = { addonId: string };

function ProductRow({ product }: { product: ProductPricingRow }) {
   return (
      <div className="grid grid-cols-[1fr_auto_auto] items-start gap-4 py-5 border-b last:border-0">
         <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-0.5">
               {product.icon}
            </div>
            <div>
               <p className="font-medium text-sm leading-none mb-1">
                  {product.name}
               </p>
               <p className="text-xs text-muted-foreground">
                  {product.description}
               </p>
            </div>
         </div>
         <div className="text-right min-w-[160px]">
            <Badge className="font-normal text-xs" variant="secondary">
               {product.freeLimit} grátis
            </Badge>
         </div>
         <div className="text-right min-w-[180px]">
            {product.pricingTiers.map((tier) => (
               <div key={tier.label}>
                  <p className="text-xs text-muted-foreground">{tier.label}</p>
                  <p className="text-sm font-mono font-medium">{tier.price}</p>
               </div>
            ))}
         </div>
      </div>
   );
}

function AddonCard({
   addon,
   isActive,
   hasPaymentMethod,
   onSubscribe,
   isPending,
}: {
   addon: AddonDef;
   isActive: boolean;
   hasPaymentMethod: boolean;
   onSubscribe: () => void;
   isPending: boolean;
}) {
   return (
      <Card
         className={addon.highlight ? "border-primary ring-1 ring-primary" : ""}
      >
         <CardHeader className="pb-3">
            {addon.highlight && (
               <Badge className="w-fit mb-2 text-xs" variant="default">
                  Mais popular
               </Badge>
            )}
            <div className="flex items-center gap-2 mb-1">
               <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {addon.icon}
               </div>
               <CardTitle className="text-sm font-semibold">
                  {addon.label}
               </CardTitle>
               {isActive && (
                  <Badge
                     className="text-xs bg-primary/10 text-primary border-primary/20"
                     variant="secondary"
                  >
                     Ativo
                  </Badge>
               )}
            </div>
            <div className="flex items-baseline gap-0.5">
               <span className="text-2xl font-bold tracking-tight">
                  {addon.price}
               </span>
               <span className="text-xs text-muted-foreground">
                  {addon.period}
               </span>
            </div>
            <CardDescription className="text-xs leading-relaxed">
               {addon.tagline}
            </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4 pt-0">
            <ul className="space-y-2">
               {addon.features.map((f) => (
                  <li className="flex items-center gap-2 text-xs" key={f}>
                     <Check className="size-3.5 shrink-0 text-primary" />
                     <span>{f}</span>
                  </li>
               ))}
            </ul>
            {isActive ? (
               <Button
                  className="w-full"
                  onClick={onSubscribe}
                  size="sm"
                  variant="outline"
               >
                  Gerenciar
               </Button>
            ) : (
               <Button
                  className="w-full"
                  disabled={!hasPaymentMethod || isPending}
                  onClick={onSubscribe}
                  size="sm"
                  variant={addon.highlight ? "default" : "outline"}
               >
                  {addon.ctaLabel}
               </Button>
            )}
            {!hasPaymentMethod && !isActive && (
               <p className="text-xs text-center text-muted-foreground">
                  Ative pay-as-you-go para adquirir
               </p>
            )}
         </CardContent>
      </Card>
   );
}

export function BillingPlans() {
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

   const handleBillingPortal = () => {
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
      <div className="space-y-8 max-w-4xl">
         <div>
            <h2 className="text-xl font-semibold tracking-tight">
               Preços simples e transparentes
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
               Comece de graça. Pague apenas pelo que usar. Sem surpresas, sem
               "fale com vendas".
            </p>
         </div>

         <div>
            <div className="flex items-center justify-between mb-3">
               <h3 className="text-sm font-semibold">Pay as you go</h3>
               <Badge variant="outline" className="text-xs font-normal">
                  Gratuito para começar
               </Badge>
            </div>
            <Card>
               <CardContent className="p-0">
                  <div className="grid grid-cols-[1fr_auto_auto] px-5 py-3 border-b bg-muted/40 rounded-t-lg">
                     <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Produto
                     </p>
                     <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right min-w-[160px]">
                        Tier gratuito
                     </p>
                     <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right min-w-[180px]">
                        Além do limite
                     </p>
                  </div>
                  <div className="px-5">
                     {PRODUCTS.map((product) => (
                        <ProductRow key={product.name} product={product} />
                     ))}
                  </div>
               </CardContent>
            </Card>
         </div>

         <Separator />

         <div>
            <div className="mb-4">
               <h3 className="text-sm font-semibold">Add-ons</h3>
               <p className="text-xs text-muted-foreground mt-1">
                  Recursos adicionais para times que precisam de mais controle.
               </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
               {ADDONS.map((addon) => (
                  <AddonCard
                     addon={addon}
                     hasPaymentMethod={hasPaymentMethod}
                     isActive={activeAddonIds.has(addon.id)}
                     isPending={isPending}
                     key={addon.id}
                     onSubscribe={handleBillingPortal}
                  />
               ))}
            </div>
         </div>
      </div>
   );
}
