import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { cn } from "@packages/ui/lib/utils";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
   ArrowDownRight,
   ArrowUpRight,
   BadgeCheck,
   BarChart3,
   Bell,
   Building2,
   CreditCard,
   FileText,
   Landmark,
   type LucideIcon,
   LogOut,
   Percent,
   Settings,
   Tag,
   Users,
   Wallet,
   Zap,
} from "lucide-react";
import { Suspense, useCallback } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useHaptic } from "@/hooks/use-haptic";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { betterAuthClient, useTRPC } from "@/integrations/clients";
import { ThemeSwitcher } from "./theme-provider";

interface NavItem {
   icon: LucideIcon;
   id: string;
   label: string;
   url: string;
}

function MoreMenuContent() {
   const { activeOrganization } = useActiveOrganization();
   const { closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const { trigger: haptic } = useHaptic();
   const router = useRouter();
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const {
      canAccessTags,
      canAccessCostCenters,
      canAccessCounterparties,
      canAccessInterestTemplates,
      canAccessAutomations,
   } = usePlanFeatures();

   const { data: session } = useSuspenseQuery(
      trpc.session.getSession.queryOptions(),
   );

   // Only show categorization if user has more than just categories
   const showCategorizationSection = canAccessTags || canAccessCostCenters;

   const handleLogout = useCallback(async () => {
      await betterAuthClient.signOut({
         fetchOptions: {
            onError: ({ error }) => {
               toast.error(error.message, { id: "logout" });
            },
            onRequest: () => {
               toast.loading("Saindo...", { id: "logout" });
            },
            onSuccess: async () => {
               await queryClient.invalidateQueries({
                  queryKey: trpc.session.getSession.queryKey(),
               });
               router.navigate({
                  to: "/auth/sign-in",
               });
               toast.success("Desconectado com sucesso", { id: "logout" });
            },
         },
      });
      closeCredenza();
   }, [queryClient, router.navigate, closeCredenza, trpc.session.getSession]);

   const handleLogoutClick = useCallback(() => {
      closeCredenza();
      openAlertDialog({
         actionLabel: "Sair",
         cancelLabel: "Cancelar",
         description: "Tem certeza de que deseja sair da sua conta?",
         onAction: handleLogout,
         title: "Confirmar saída",
         variant: "destructive",
      });
   }, [closeCredenza, openAlertDialog, handleLogout]);

   const userQuickActions: NavItem[] = [
      {
         icon: BadgeCheck,
         id: "account",
         label: "Conta",
         url: "/$slug/settings/profile",
      },
      {
         icon: CreditCard,
         id: "billing",
         label: "Cobrança",
         url: "/$slug/settings/billing",
      },
      {
         icon: Bell,
         id: "notifications",
         label: "Notificações",
         url: "/$slug/settings/notifications",
      },
   ];

   const sections: { title: string; items: NavItem[] }[] = [
      {
         items: [
            {
               icon: Building2,
               id: "bank-accounts",
               label: "Contas Bancárias",
               url: "/$slug/bank-accounts",
            },
            {
               icon: BarChart3,
               id: "reports",
               label: "Relatórios",
               url: "/$slug/reports",
            },
            {
               icon: Wallet,
               id: "budgets",
               label: "Orçamentos",
               url: "/$slug/budgets",
            },
         ],
         title: "Suas finanças",
      },
      {
         items: [
            {
               icon: ArrowDownRight,
               id: "payables",
               label: "A Pagar",
               url: "/$slug/bills?type=payable",
            },
            {
               icon: ArrowUpRight,
               id: "receivables",
               label: "A Receber",
               url: "/$slug/bills?type=receivable",
            },
            ...(canAccessCounterparties
               ? [
                    {
                       icon: Users,
                       id: "counterparties",
                       label: "Fornecedores",
                       url: "/$slug/counterparties",
                    },
                 ]
               : []),
            ...(canAccessInterestTemplates
               ? [
                    {
                       icon: Percent,
                       id: "interest-templates",
                       label: "Modelos de Juros",
                       url: "/$slug/interest-templates",
                    },
                 ]
               : []),
         ],
         title: "Contas",
      },
      ...(showCategorizationSection
         ? [
              {
                 items: [
                    {
                       icon: FileText,
                       id: "categories",
                       label: "Categorias",
                       url: "/$slug/categories",
                    },
                    ...(canAccessCostCenters
                       ? [
                            {
                               icon: Landmark,
                               id: "cost-centers",
                               label: "Centros de Custo",
                               url: "/$slug/cost-centers",
                            },
                         ]
                       : []),
                    ...(canAccessTags
                       ? [
                            {
                               icon: Tag,
                               id: "tags",
                               label: "Tags",
                               url: "/$slug/tags",
                            },
                         ]
                       : []),
                 ],
                 title: "Categorização",
              },
           ]
         : []),
      ...(canAccessAutomations
         ? [
              {
                 items: [
                    {
                       icon: Zap,
                       id: "automations",
                       label: "Automações",
                       url: "/$slug/automations",
                    },
                 ],
                 title: "Automação",
              },
           ]
         : []),
      {
         items: [
            {
               icon: Settings,
               id: "settings",
               label: "Configurações",
               url: "/$slug/settings",
            },
         ],
         title: "Conta",
      },
   ];

   const handleItemClick = () => {
      haptic("light");
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader className="text-left">
            <div className="flex items-center gap-3">
               <Avatar className="h-12 w-12 rounded-lg">
                  <AvatarImage
                     alt={session?.user.name}
                     src={session?.user.image ?? ""}
                  />
                  <AvatarFallback className="rounded-lg text-lg">
                     {session?.user.name?.charAt(0) || "?"}
                  </AvatarFallback>
               </Avatar>
               <div className="flex-1 min-w-0">
                  <CredenzaTitle className="text-base">
                     {session?.user.name}
                  </CredenzaTitle>
                  <CredenzaDescription className="truncate">
                     {session?.user.email}
                  </CredenzaDescription>
               </div>
            </div>
         </CredenzaHeader>
         <CredenzaBody className="pb-4">
            <div className="flex flex-col gap-6">
               {/* User Quick Actions */}
               <div>
                  <div className="grid grid-cols-3 gap-2">
                     {userQuickActions.map((item) => {
                        const Icon = item.icon;
                        return (
                           <Link
                              className={cn(
                                 "flex flex-col items-center justify-center gap-2 p-3",
                                 "rounded-xl border bg-card",
                                 "transition-colors active:bg-accent",
                              )}
                              key={item.id}
                              onClick={() => handleItemClick()}
                              params={{ slug: activeOrganization.slug }}
                              to={item.url}
                           >
                              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                                 <Icon className="size-5 text-primary" />
                              </div>
                              <span className="text-center text-xs font-medium leading-tight">
                                 {item.label}
                              </span>
                           </Link>
                        );
                     })}
                  </div>
               </div>

               {/* Navigation Sections */}
               {sections.map((section) => (
                  <div key={section.title}>
                     <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.title}
                     </h3>
                     <div className="grid grid-cols-3 gap-2">
                        {section.items.map((item) => {
                           const Icon = item.icon;

                           return (
                              <Link
                                 className={cn(
                                    "flex flex-col items-center justify-center gap-2 p-3",
                                    "rounded-xl border bg-card",
                                    "transition-colors active:bg-accent",
                                 )}
                                 key={item.id}
                                 onClick={() => handleItemClick()}
                                 params={{ slug: activeOrganization.slug }}
                                 to={item.url}
                              >
                                 <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                                    <Icon className="size-5 text-primary" />
                                 </div>
                                 <span className="text-center text-xs font-medium leading-tight">
                                    {item.label}
                                 </span>
                              </Link>
                           );
                        })}
                     </div>
                  </div>
               ))}

               {/* Preferences */}
               <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                     Preferências
                  </h3>
                  <div className="space-y-3 rounded-xl border bg-card p-4">
                     <div className="flex items-center justify-between">
                        <span className="text-sm">Tema</span>
                        <ThemeSwitcher />
                     </div>
                  </div>
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
               className="w-full gap-2"
               onClick={handleLogoutClick}
               variant="destructive"
            >
               <LogOut className="size-4" />
               Sair
            </Button>
         </CredenzaFooter>
      </>
   );
}

function MoreMenuSkeleton() {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Menu</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 mb-6">
               <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
               <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}

export function MoreMenuCredenza() {
   return (
      <ErrorBoundary fallback={<MoreMenuSkeleton />}>
         <Suspense fallback={<MoreMenuSkeleton />}>
            <MoreMenuContent />
         </Suspense>
      </ErrorBoundary>
   );
}
