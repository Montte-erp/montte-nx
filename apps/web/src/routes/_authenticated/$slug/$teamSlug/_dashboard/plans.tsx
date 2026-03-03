import { AddonName } from "@packages/stripe/constants";
import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
} from "@packages/ui/components/accordion";
import { Button } from "@packages/ui/components/button";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
   Check,
   CreditCard,
   Headphones,
   MessageCircle,
   RefreshCcw,
   Shield,
   Sparkles,
   Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useTransition } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { authClient } from "@/integrations/better-auth/auth-client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/plans",
)({
   component: PlansPage,
});

// ============================================
// Addon definitions
// ============================================

interface AddonDef {
   name: AddonName;
   displayName: string;
   price: string;
   perUnit: string;
   description: string;
   features: string[];
   highlighted?: boolean;
   icon: ReactNode;
}

const PLATFORM_ADDON_DEFS: AddonDef[] = [
   {
      name: AddonName.BOOST,
      displayName: "Boost",
      price: "R$ 199",
      perUnit: "/mês",
      description: "Limites ampliados para equipes em crescimento",
      features: [
         "Limites 5× em todos os módulos",
         "Suporte prioritário",
         "Acesso antecipado a funcionalidades",
         "Dashboard avançado",
      ],
      icon: <Zap className="size-6" />,
   },
   {
      name: AddonName.SCALE,
      displayName: "Scale",
      price: "R$ 599",
      perUnit: "/mês",
      description: "Para operações de grande volume",
      features: [
         "Limites 20× em todos os módulos",
         "SLA dedicado",
         "Integrações avançadas",
         "Gerente de conta",
      ],
      highlighted: true,
      icon: <Sparkles className="size-6" />,
   },
   {
      name: AddonName.ENTERPRISE,
      displayName: "Enterprise",
      price: "R$ 2.500+",
      perUnit: "/mês",
      description: "Infraestrutura dedicada e customizações",
      features: [
         "Limites ilimitados",
         "Deploy dedicado",
         "Customizações sob medida",
         "Suporte 24/7",
      ],
      icon: <Shield className="size-6" />,
   },
];

const MESSAGING_ADDON_DEFS: AddonDef[] = [
   {
      name: AddonName.TELEGRAM,
      displayName: "Telegram",
      price: "R$ 29",
      perUnit: "/mês",
      description: "Notificações e atendimento via Telegram",
      features: ["Bot de notificações", "Comandos personalizados"],
      icon: <MessageCircle className="size-6" />,
   },
   {
      name: AddonName.WHATSAPP,
      displayName: "WhatsApp",
      price: "R$ 39",
      perUnit: "/mês",
      description: "Notificações e atendimento via WhatsApp",
      features: ["Mensagens automáticas", "Templates Meta aprovados"],
      icon: <MessageCircle className="size-6" />,
   },
   {
      name: AddonName.MENSAGERIA_BUNDLE,
      displayName: "Bundle Mensageria",
      price: "R$ 59",
      perUnit: "/mês",
      description: "Telegram + WhatsApp com desconto",
      features: [
         "Telegram incluso",
         "WhatsApp incluso",
         "Economia de R$ 9/mês",
      ],
      highlighted: true,
      icon: <MessageCircle className="size-6" />,
   },
];

// ============================================
// Animation variants
// ============================================

const containerVariants: Variants = {
   hidden: { opacity: 0 },
   show: {
      opacity: 1,
      transition: {
         staggerChildren: 0.08,
         delayChildren: 0.15,
      },
   },
};

const cardVariants: Variants = {
   hidden: { opacity: 0, y: 40 },
   show: {
      opacity: 1,
      y: 0,
   },
};

// Trust badges
const trustBadges = [
   { icon: Shield, text: "SSL Seguro" },
   { icon: CreditCard, text: "Stripe Checkout" },
   { icon: RefreshCcw, text: "Cancelamento fácil" },
   { icon: Headphones, text: "Suporte técnico" },
];

// FAQ
const faqItems = [
   {
      question: "Como funciona o modelo pay as you go?",
      answer:
         "Cada funcionalidade tem um limite gratuito mensal. Ao ultrapassar, você paga apenas pelo excedente. Não há planos fixos — você paga exatamente pelo que usar.",
   },
   {
      question: "O que são os addons?",
      answer:
         "Addons são extensões opcionais que ampliam seus limites (Boost, Scale, Enterprise) ou habilitam canais de mensageria (Telegram, WhatsApp). Podem ser assinados separadamente ou em bundle.",
   },
   {
      question: "Posso cancelar a qualquer momento?",
      answer:
         "Sim! Todos os addons podem ser cancelados a qualquer momento. As mudanças entram em vigor no próximo ciclo de cobrança.",
   },
   {
      question: "Como funciona o pagamento?",
      answer:
         "Aceitamos os principais cartões de crédito via Stripe. Cobrança automática mensal. Faturas disponíveis no painel de cobrança.",
   },
   {
      question: "Posso ter múltiplos addons ao mesmo tempo?",
      answer:
         "Sim! Você pode combinar um addon de plataforma (Boost, Scale ou Enterprise) com um de mensageria (Telegram, WhatsApp ou Bundle) conforme sua necessidade.",
   },
];

// ============================================
// Components
// ============================================

function PlansPageErrorFallback(props: FallbackProps) {
   return createErrorFallback({
      errorDescription: "Falha ao carregar os addons. Tente novamente.",
      errorTitle: "Erro ao carregar addons",
      retryText: "Tentar novamente",
   })(props);
}

function PlansPageSkeleton() {
   return (
      <main className="flex flex-col gap-8 py-8">
         <div className="text-center space-y-4">
            <Skeleton className="h-12 w-96 mx-auto" />
            <Skeleton className="h-6 w-64 mx-auto" />
         </div>
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto w-full px-4">
            {Array.from({ length: 3 }).map((_, i) => (
               <Skeleton
                  className="h-[400px] rounded-2xl"
                  key={`addon-skeleton-${i + 1}`}
               />
            ))}
         </div>
      </main>
   );
}

function HeroSection() {
   return (
      <motion.div
         animate={{ opacity: 1, y: 0 }}
         className="text-center space-y-5 py-10"
         initial={{ opacity: 0, y: 20 }}
         transition={{ duration: 0.6, ease: "easeOut" }}
      >
         <motion.h1
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-semibold tracking-tight font-serif"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
         >
            Pay as you go — pague só pelo que usar
         </motion.h1>
         <motion.p
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
         >
            Limites gratuitos generosos em todos os módulos. Addons opcionais
            para ampliar limites ou habilitar canais de mensageria.
         </motion.p>
      </motion.div>
   );
}

function AddonCard({
   addon,
   activeAddonName,
   onSelect,
   isLoading,
}: {
   addon: AddonDef;
   activeAddonName: string | null;
   onSelect: (name: string) => void;
   isLoading: boolean;
}) {
   const isActive = activeAddonName?.toLowerCase() === addon.name.toLowerCase();

   return (
      <motion.div
         className={`relative flex flex-col rounded-3xl border p-8 bg-card/90 transition-all ${
            addon.highlighted
               ? "border-primary/50 shadow-[0_24px_60px_rgba(18,18,18,0.12)] lg:scale-[1.02]"
               : "border-muted shadow-[0_16px_40px_rgba(18,18,18,0.08)]"
         } ${isActive ? "border-green-500/60" : ""}`}
         transition={{ type: "spring", stiffness: 200, damping: 20 }}
         variants={cardVariants}
         whileHover={{ y: -6 }}
      >
         {addon.highlighted && !isActive && (
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-xl -z-10" />
         )}

         {addon.highlighted && !isActive && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
               <motion.span
                  animate={{ scale: 1 }}
                  className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg"
                  initial={{ scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
               >
                  <Sparkles className="size-3.5" />
                  Mais popular
               </motion.span>
            </div>
         )}
         {isActive && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
               <motion.span
                  animate={{ scale: 1 }}
                  className="bg-green-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg"
                  initial={{ scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
               >
                  <Check className="size-3.5" />
                  Ativo
               </motion.span>
            </div>
         )}

         <div className="flex items-center gap-3 mb-4">
            <div
               className={`p-3 rounded-2xl ${
                  addon.highlighted
                     ? "bg-primary/10 text-primary"
                     : "bg-muted text-muted-foreground"
               }`}
            >
               {addon.icon}
            </div>
            <div>
               <p className="text-sm text-muted-foreground">Addon</p>
               <h3 className="text-xl font-semibold tracking-tight">
                  {addon.displayName}
               </h3>
            </div>
         </div>

         <p className="text-sm text-muted-foreground mb-4">
            {addon.description}
         </p>

         <div className="text-center mb-6">
            <AnimatePresence mode="wait">
               <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-semibold inline-block tabular-nums"
                  exit={{ opacity: 0, y: -10 }}
                  initial={{ opacity: 0, y: 10 }}
                  key={addon.price}
                  transition={{ duration: 0.2 }}
               >
                  {addon.price}
               </motion.span>
            </AnimatePresence>
            <span className="text-muted-foreground">{addon.perUnit}</span>
         </div>

         <div className="space-y-3 flex-1">
            {addon.features.map((feature) => (
               <div className="flex items-center gap-3" key={feature}>
                  <div className="flex-shrink-0 size-5 rounded-full bg-green-500/10 flex items-center justify-center">
                     <Check className="size-3 text-green-500" />
                  </div>
                  <span className="text-sm">{feature}</span>
               </div>
            ))}
         </div>

         <motion.div
            className="mt-8"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
         >
            <Button
               className={`w-full h-12 text-base font-medium ${
                  addon.highlighted && !isActive
                     ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                     : ""
               }`}
               disabled={isLoading}
               onClick={() => onSelect(addon.name)}
               variant={addon.highlighted && !isActive ? "default" : "outline"}
            >
               {isLoading
                  ? "Processando..."
                  : isActive
                    ? "Gerenciar"
                    : "Contratar"}
            </Button>
         </motion.div>
      </motion.div>
   );
}

function TrustBadges() {
   return (
      <motion.div
         animate={{ opacity: 1, y: 0 }}
         className="flex flex-wrap justify-center gap-8 py-12"
         initial={{ opacity: 0, y: 20 }}
         transition={{ duration: 0.6, delay: 0.4 }}
      >
         {trustBadges.map((badge, index) => (
            <motion.div
               animate={{ opacity: 1, y: 0 }}
               className="flex items-center gap-2 text-muted-foreground"
               initial={{ opacity: 0, y: 10 }}
               key={badge.text}
               transition={{ delay: 0.5 + index * 0.1 }}
            >
               <badge.icon className="size-5" />
               <span className="text-sm font-medium">{badge.text}</span>
            </motion.div>
         ))}
      </motion.div>
   );
}

function FAQSection() {
   return (
      <motion.div
         animate={{ opacity: 1, y: 0 }}
         className="max-w-2xl mx-auto py-12 px-4"
         initial={{ opacity: 0, y: 20 }}
         transition={{ duration: 0.6, delay: 0.5 }}
      >
         <h2 className="text-2xl font-bold text-center mb-8">
            Perguntas frequentes
         </h2>
         <Accordion className="space-y-2" collapsible type="single">
            {faqItems.map((item, index) => (
               <AccordionItem
                  className="border rounded-lg px-4 data-[state=open]:bg-muted/50"
                  key={`faq-${index + 1}`}
                  value={`item-${index + 1}`}
               >
                  <AccordionTrigger className="text-left font-medium hover:no-underline">
                     {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                     {item.answer}
                  </AccordionContent>
               </AccordionItem>
            ))}
         </Accordion>
      </motion.div>
   );
}

function PlansPageContent() {
   const { activeOrganization, activeSubscription } = useActiveOrganization();
   const [isLoading, startTransition] = useTransition();

   const activeAddonName = activeSubscription
      ? (activeSubscription.plan as string).toLowerCase()
      : null;

   const handleSelectAddon = (addonName: string) => {
      startTransition(async () => {
         if (!activeOrganization?.id) {
            toast.error("Nenhuma organização selecionada");
            return;
         }

         try {
            const baseUrl = `${window.location.origin}${window.location.pathname}`;

            await authClient.subscription.upgrade({
               annual: false,
               cancelUrl: `${baseUrl}?cancel=true`,
               plan: addonName,
               referenceId: activeOrganization?.id,
               successUrl: `${baseUrl}?success=true`,
            });
         } catch (error) {
            console.error("Failed to create checkout session:", error);
            toast.error("Falha ao iniciar checkout", {
               description: "Tente novamente mais tarde.",
            });
         }
      });
   };

   return (
      <main className="relative overflow-hidden">
         <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-[#f7f1e8] via-background to-background" />
            <div className="absolute -top-24 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
         </div>

         <div className="relative z-10 flex flex-col gap-12 pb-16">
            <section className="px-4">
               <HeroSection />
            </section>

            <section className="px-4">
               <div className="max-w-6xl mx-auto">
                  <h2 className="text-xl font-semibold mb-6">
                     Addons de Plataforma
                  </h2>
                  <motion.div
                     className="grid gap-6 lg:gap-8 md:grid-cols-2 lg:grid-cols-3"
                     initial="hidden"
                     variants={containerVariants}
                     viewport={{ once: true, margin: "-100px" }}
                     whileInView="show"
                  >
                     {PLATFORM_ADDON_DEFS.map((addon) => (
                        <AddonCard
                           activeAddonName={activeAddonName}
                           addon={addon}
                           isLoading={isLoading}
                           key={addon.name}
                           onSelect={handleSelectAddon}
                        />
                     ))}
                  </motion.div>
               </div>
            </section>

            <section className="px-4">
               <div className="max-w-6xl mx-auto">
                  <h2 className="text-xl font-semibold mb-6">
                     Addons de Mensageria
                  </h2>
                  <motion.div
                     className="grid gap-6 lg:gap-8 md:grid-cols-2 lg:grid-cols-3"
                     initial="hidden"
                     variants={containerVariants}
                     viewport={{ once: true, margin: "-100px" }}
                     whileInView="show"
                  >
                     {MESSAGING_ADDON_DEFS.map((addon) => (
                        <AddonCard
                           activeAddonName={activeAddonName}
                           addon={addon}
                           isLoading={isLoading}
                           key={addon.name}
                           onSelect={handleSelectAddon}
                        />
                     ))}
                  </motion.div>
               </div>
            </section>

            <TrustBadges />
            <FAQSection />
         </div>
      </main>
   );
}

function PlansPage() {
   return (
      <ErrorBoundary FallbackComponent={PlansPageErrorFallback}>
         <Suspense fallback={<PlansPageSkeleton />}>
            <PlansPageContent />
         </Suspense>
      </ErrorBoundary>
   );
}
