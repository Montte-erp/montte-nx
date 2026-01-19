import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { DefaultHeader } from "@/default/default-header";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { UpgradeRequired } from "@/features/billing/ui/upgrade-required";
import {
   MembersDataTable,
   MembersDataTableSkeleton,
} from "@/features/organization/ui/members-data-table";
import { betterAuthClient, useTRPC } from "@/integrations/clients";
import { MembersQuickActionsToolbar } from "./organization-members-quick-actions-toolbar";

function MembersPageContent() {
   const trpc = useTRPC();
   const [searchTerm, setSearchTerm] = useState("");
   const [roleFilter, setRoleFilter] = useState("all");

   const { data: members } = useSuspenseQuery(
      trpc.organization.getActiveOrganizationMembers.queryOptions(),
   );

   const removeMember = useCallback(async (memberId: string) => {
      await betterAuthClient.organization.removeMember(
         {
            memberIdOrEmail: memberId,
         },
         {
            onRequest: () => {
               toast.loading("Removendo membro...");
            },
            onSuccess: () => {
               toast.success("Membro removido com sucesso");
            },
            onError: (ctx) => {
               toast.error(ctx.error.message || "Falha ao remover membro");
            },
         },
      );
   }, []);

   const handleRemove = (memberId: string) => {
      removeMember(memberId);
   };

   const handleBulkRemove = (memberIds: string[]) => {
      for (const id of memberIds) {
         removeMember(id);
      }
   };

   const hasActiveFilters = roleFilter !== "all";

   const handleClearFilters = () => {
      setRoleFilter("all");
   };

   return (
      <MembersDataTable
         filters={{
            hasActiveFilters,
            onClearFilters: handleClearFilters,
            onRoleFilterChange: setRoleFilter,
            onSearchChange: setSearchTerm,
            roleFilter,
            searchTerm,
         }}
         members={members}
         onBulkRemove={handleBulkRemove}
         onRemove={handleRemove}
      />
   );
}

function MembersPageError({ error }: { error: Error }) {
   return (
      <div className="text-center py-8">
         <p className="text-muted-foreground">
            Ocorreu um erro. Por favor, tente novamente.
         </p>
         <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
   );
}

export function OrganizationMembersPage() {
   const { canAccessOrgMembers } = usePlanFeatures();

   return (
      <UpgradeRequired
         featureName="Membros da Organização"
         hasAccess={canAccessOrgMembers}
         requiredPlan="erp"
      >
         <main className="flex flex-col gap-4">
            <DefaultHeader
               actions={<MembersQuickActionsToolbar />}
               description="Gerencie os membros da sua organização"
               title="Membros"
            />

            <ErrorBoundary FallbackComponent={MembersPageError}>
               <Suspense fallback={<MembersDataTableSkeleton />}>
                  <MembersPageContent />
               </Suspense>
            </ErrorBoundary>
         </main>
      </UpgradeRequired>
   );
}
