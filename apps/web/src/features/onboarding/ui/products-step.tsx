import { cn } from "@packages/ui/lib/utils";
import { CreditCard, LayoutDashboard, Tag, Wallet } from "lucide-react";
import {
   forwardRef,
   useCallback,
   useEffect,
   useImperativeHandle,
} from "react";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import type { StepHandle, StepState } from "./step-handle";

interface Feature {
   icon: React.ComponentType<{ className?: string }>;
   title: string;
   description: string;
}

const FEATURES: Feature[] = [
   {
      icon: Wallet,
      title: "Contas bancárias",
      description: "Gerencie contas correntes, poupança e cartões",
   },
   {
      icon: CreditCard,
      title: "Transações",
      description: "Registre receitas, despesas e transferências",
   },
   {
      icon: Tag,
      title: "Categorias",
      description: "Organize seus gastos por categoria",
   },
   {
      icon: LayoutDashboard,
      title: "Dashboard financeiro",
      description: "Visualize suas finanças com métricas automáticas",
   },
];

interface ProductsStepProps {
   organizationId: string;
   teamId: string;
   teamSlug: string;
   onComplete: (slug: string, teamSlug: string) => void;
   onStateChange: (state: StepState) => void;
   isPending?: boolean;
}

export const ProductsStep = forwardRef<StepHandle, ProductsStepProps>(
   function ProductsStep(
      {
         organizationId: _organizationId,
         teamId,
         teamSlug,
         onComplete,
         onStateChange,
         isPending: isPendingProp = false,
      },
      ref,
   ) {
      const handleComplete = useCallback(async () => {
         try {
            const result = await orpc.onboarding.completeOnboarding.call({
               products: ["finance"],
            });

            await authClient.organization.setActiveTeam({ teamId });

            toast.success("Onboarding concluído!");
            onComplete(result.slug, teamSlug);
            return true;
         } catch (error) {
            toast.error(
               error instanceof Error
                  ? error.message
                  : "Erro ao concluir onboarding.",
            );
            return false;
         }
      }, [teamId, teamSlug, onComplete]);

      const isPending = isPendingProp;
      const canContinue = true;

      useImperativeHandle(
         ref,
         () => ({
            submit: handleComplete,
            canContinue,
            isPending,
         }),
         [handleComplete, isPending],
      );

      useEffect(() => {
         onStateChange({ canContinue, isPending });
      }, [canContinue, isPending, onStateChange]);

      return (
         <div className="space-y-6">
            <div className="space-y-2 text-center">
               <h2 className="font-serif text-2xl font-semibold">
                  Finanças Pessoais
               </h2>
               <p className="text-sm text-muted-foreground">
                  Tudo que você precisa para acompanhar suas finanças em um só
                  lugar.
               </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
               {FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                     <div
                        className={cn(
                           "flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3",
                           isPending && "opacity-50",
                        )}
                        key={feature.title}
                     >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                           <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-sm font-medium">{feature.title}</p>
                           <p className="text-xs text-muted-foreground truncate">
                              {feature.description}
                           </p>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      );
   },
);
