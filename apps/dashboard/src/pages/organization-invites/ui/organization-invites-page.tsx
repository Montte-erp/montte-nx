import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { DefaultHeader } from "@/default/default-header";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { UpgradeRequired } from "@/features/billing/ui/upgrade-required";
import {
   InvitesDataTable,
   InvitesDataTableSkeleton,
} from "@/features/organization/ui/invites-data-table";
import { betterAuthClient, useTRPC } from "@/integrations/clients";
import { InvitesQuickActionsToolbar } from "./organization-invites-quick-actions-toolbar";

function InvitesPageContent() {
   const trpc = useTRPC();
   const [searchTerm, setSearchTerm] = useState("");
   const [statusFilter, setStatusFilter] = useState("all");
   const [roleFilter, setRoleFilter] = useState("all");
   const [currentPage, setCurrentPage] = useState(1);
   const pageSize = 10;

   const { data: invitesData } = useSuspenseQuery(
      trpc.organizationInvites.listInvitations.queryOptions({
         limit: pageSize,
         offset: (currentPage - 1) * pageSize,
      }),
   );

   const inviteMember = useCallback(
      async (data: { email: string; role: "member" | "admin" | "owner" }) => {
         await betterAuthClient.organization.inviteMember(
            {
               email: data.email,
               role: data.role,
            },
            {
               onRequest: () => {
                  toast.loading("Sending invitation...");
               },
               onSuccess: () => {
                  toast.success("Invitation sent successfully");
               },
               onError: (ctx) => {
                  toast.error(ctx.error.message || "Failed to send invitation");
               },
            },
         );
      },
      [],
   );

   const revokeInvitation = useCallback(async (invitationId: string) => {
      await betterAuthClient.organization.cancelInvitation(
         {
            invitationId,
         },
         {
            onRequest: () => {
               toast.loading("Revoking invitation...");
            },
            onSuccess: () => {
               toast.success("Invitation revoked successfully");
            },
            onError: (ctx) => {
               toast.error(ctx.error.message || "Failed to revoke invitation");
            },
         },
      );
   }, []);

   const handleResend = (invite: (typeof invitesData.invitations)[number]) => {
      inviteMember({
         email: invite.email,
         role: invite.role.toLowerCase() as "member" | "admin" | "owner",
      });
   };

   const handleRevoke = (inviteId: string) => {
      revokeInvitation(inviteId);
   };

   const handleBulkResend = (inviteIds: string[]) => {
      const invites = invitesData.invitations.filter((inv) =>
         inviteIds.includes(inv.id),
      );
      for (const invite of invites) {
         inviteMember({
            email: invite.email,
            role: invite.role.toLowerCase() as "member" | "admin" | "owner",
         });
      }
   };

   const handleBulkRevoke = (inviteIds: string[]) => {
      for (const id of inviteIds) {
         revokeInvitation(id);
      }
   };

   const hasActiveFilters = statusFilter !== "all" || roleFilter !== "all";

   const handleClearFilters = () => {
      setStatusFilter("all");
      setRoleFilter("all");
   };

   const totalPages = Math.ceil(invitesData.total / pageSize);

   return (
      <InvitesDataTable
         filters={{
            hasActiveFilters,
            onClearFilters: handleClearFilters,
            onRoleFilterChange: setRoleFilter,
            onSearchChange: setSearchTerm,
            onStatusFilterChange: setStatusFilter,
            roleFilter,
            searchTerm,
            statusFilter,
         }}
         invites={invitesData.invitations}
         onBulkResend={handleBulkResend}
         onBulkRevoke={handleBulkRevoke}
         onResend={handleResend}
         onRevoke={handleRevoke}
         pagination={{
            currentPage,
            onPageChange: setCurrentPage,
            pageSize,
            totalCount: invitesData.total,
            totalPages,
         }}
      />
   );
}

function InvitesPageError({ error }: { error: Error }) {
   return (
      <div className="text-center py-8">
         <p className="text-muted-foreground">
            Ocorreu um erro. Por favor, tente novamente.
         </p>
         <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
   );
}

export function OrganizationInvitesPage() {
   const { canAccessOrgMembers } = usePlanFeatures();

   return (
      <UpgradeRequired
         featureName="Convites da Organização"
         hasAccess={canAccessOrgMembers}
         requiredPlan="erp"
      >
         <main className="flex flex-col gap-4">
            <DefaultHeader
               actions={<InvitesQuickActionsToolbar />}
               description="Gerencie os convites da sua organização"
               title="Convites"
            />

            <ErrorBoundary FallbackComponent={InvitesPageError}>
               <Suspense fallback={<InvitesDataTableSkeleton />}>
                  <InvitesPageContent />
               </Suspense>
            </ErrorBoundary>
         </main>
      </UpgradeRequired>
   );
}
