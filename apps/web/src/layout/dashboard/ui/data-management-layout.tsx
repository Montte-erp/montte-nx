import { Button } from "@packages/ui/components/button";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { ChevronLeft, Database } from "lucide-react";
import type * as React from "react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { DataManagementMobileNav } from "./data-management-mobile-nav";

const DATA_MANAGEMENT_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Dados",
   message: "Esta funcionalidade está em conceito.",
   ctaLabel: "Deixar feedback",
   stage: "concept",
   icon: Database,
   bullets: [
      "Capture eventos de sistemas externos via webhooks e SDKs",
      "Configure destinos para enviar seus dados a warehouses e ferramentas externas",
      "Seu feedback nos ajuda a priorizar as integrações certas",
   ],
};

interface DataManagementLayoutProps {
   children: React.ReactNode;
}

export function DataManagementLayout({ children }: DataManagementLayoutProps) {
   const isMobile = useIsMobile();
   const { pathname } = useLocation();
   const { activeOrganization } = useActiveOrganization();
   const { teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });

   const isIndexRoute = pathname.endsWith("/data-management");

   if (isMobile) {
      if (isIndexRoute) {
         return <DataManagementMobileNav />;
      }

      return (
         <div className="flex h-full flex-col gap-4">
            <Button asChild className="w-fit" variant="ghost">
               <Link
                  params={{
                     slug: activeOrganization.slug,
                     teamSlug: teamSlug ?? "",
                  }}
                  to="/$slug/$teamSlug/analytics/data-management"
               >
                  <ChevronLeft className="size-4 mr-1" />
                  Gerenciamento de Dados
               </Link>
            </Button>
            <div className="flex-1">{children}</div>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-4">
         <EarlyAccessBanner template={DATA_MANAGEMENT_BANNER} />
         {children}
      </div>
   );
}
