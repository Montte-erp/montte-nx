import { createFileRoute } from "@tanstack/react-router";
import { Plug } from "lucide-react";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/integrations",
)({
   component: ProjectIntegrationsPage,
});

const INTEGRATIONS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Integrações",
   message: "Estamos construindo nosso ecossistema de integrações.",
   ctaLabel: "Sugerir integração",
   stage: "concept",
   icon: Plug,
   surveyId: "019d3b2e-92f9-0000-1abb-5edfc2ee742b",
   bullets: [
      "Quais meios de pagamento você utiliza?",
      "Há alguma plataforma de e-commerce ou marketplace que precisa se conectar?",
      "Qual integração desbloquearia mais valor na sua operação?",
   ],
};

function ProjectIntegrationsPage() {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Integrações</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Conecte ferramentas externas ao seu espaço e centralize sua
               operação.
            </p>
         </div>

         <EarlyAccessBanner template={INTEGRATIONS_BANNER} />
      </div>
   );
}
