import type { ScopeAccess } from "@core/database/schemas/personal-api-key";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { TooltipProvider } from "@packages/ui/components/tooltip";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Key, Plus } from "lucide-react";
import { Suspense, useMemo } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { CreateKeyForm } from "@/features/personal-api-keys/ui/create-key-form";
import { KeyRevealDialog } from "@/features/personal-api-keys/ui/key-reveal-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/personal-api-keys",
)({
   component: PersonalApiKeysPage,
});

// =============================================================================
// Helpers
// =============================================================================

function formatDate(date: Date | string | null): string {
   if (!date) return "Nunca";
   const d = new Date(date);
   return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
   });
}

function formatRelativeDate(date: Date | string | null): string {
   if (!date) return "Nunca utilizada";
   const d = new Date(date);
   const now = new Date();
   const diff = now.getTime() - d.getTime();
   const minutes = Math.floor(diff / 60000);
   const hours = Math.floor(diff / 3600000);
   const days = Math.floor(diff / 86400000);

   if (minutes < 1) return "Agora";
   if (minutes < 60) return `${minutes} min atrás`;
   if (hours < 24) return `${hours}h atrás`;
   if (days < 7) return `${days}d atrás`;
   return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
   });
}

function getScopesSummary(scopes: Record<string, ScopeAccess>): string {
   const entries = Object.entries(scopes);
   const writeCount = entries.filter(([, v]) => v === "write").length;
   const readCount = entries.filter(([, v]) => v === "read").length;

   if (writeCount === entries.length) return "Acesso total";
   if (readCount === entries.length) return "Somente leitura";

   const parts: string[] = [];
   if (writeCount > 0) parts.push(`${writeCount} escrita`);
   if (readCount > 0) parts.push(`${readCount} leitura`);
   if (parts.length === 0) return "Sem permissões";
   return parts.join(", ");
}

// =============================================================================
// Error & Loading
// =============================================================================

function PersonalApiKeysErrorFallback(props: FallbackProps) {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">
               Chaves de API pessoais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie suas chaves de API pessoais para acesso direto à API.
            </p>
         </div>
         <Card>
            <CardContent className="py-8">
               {createErrorFallback({
                  errorDescription: "Erro ao carregar chaves de API",
                  errorTitle: "Erro",
                  retryText: "Tentar novamente",
               })(props)}
            </CardContent>
         </Card>
      </div>
   );
}

function PersonalApiKeysSkeleton() {
   return (
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <div>
               <Skeleton className="h-8 w-56" />
               <Skeleton className="h-4 w-80 mt-2" />
            </div>
            <Skeleton className="h-9 w-32" />
         </div>
         <Card>
            <CardContent className="p-0">
               <div className="space-y-0">
                  {Array.from({ length: 3 }, (_, i) => i + 1).map((id) => (
                     <div
                        className="flex items-center gap-4 border-b px-6 py-4 last:border-b-0"
                        key={`skeleton-key-${id}`}
                     >
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-5 w-24 ml-auto" />
                     </div>
                  ))}
               </div>
            </CardContent>
         </Card>
      </div>
   );
}

// =============================================================================
// Keys Table
// =============================================================================

interface ApiKeyRow {
   id: string;
   label: string;
   maskedKey: string;
   scopes: Record<string, ScopeAccess>;
   organizationAccess: "all" | string[];
   lastUsedAt: Date | null;
   createdAt: Date;
}

function KeysTable({ keys }: { keys: ApiKeyRow[] }) {
   if (keys.length === 0) {
      return (
         <Card>
            <CardContent className="py-0">
               <Empty className="border-none py-12">
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Key className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma chave de API</EmptyTitle>
                     <EmptyDescription>
                        Crie uma chave de API pessoal para acessar a API do
                        Montte programaticamente.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </CardContent>
         </Card>
      );
   }

   const columns = useMemo<ColumnDef<ApiKeyRow>[]>(
      () => [
         {
            accessorKey: "label",
            header: "Nome",
            cell: ({ row }) => (
               <span className="font-medium">{row.original.label}</span>
            ),
         },
         {
            accessorKey: "maskedKey",
            header: "Chave",
            cell: ({ row }) => (
               <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {row.original.maskedKey}
               </code>
            ),
         },
         {
            accessorKey: "scopes",
            header: "Permissões",
            cell: ({ row }) => (
               <Badge variant="secondary">
                  {getScopesSummary(row.original.scopes)}
               </Badge>
            ),
         },
         {
            accessorKey: "lastUsedAt",
            header: "Último uso",
            cell: ({ row }) => (
               <span className="text-muted-foreground text-sm">
                  {formatRelativeDate(row.original.lastUsedAt)}
               </span>
            ),
         },
         {
            accessorKey: "createdAt",
            header: "Criada em",
            cell: ({ row }) => (
               <span className="text-muted-foreground text-sm">
                  {formatDate(row.original.createdAt)}
               </span>
            ),
         },
      ],
      [],
   );

   return <DataTable columns={columns} data={keys} />;
}

// =============================================================================
// Main Content
// =============================================================================

function PersonalApiKeysContent() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { data: keys } = useSuspenseQuery(
      orpc.personalApiKey.list.queryOptions({}),
   );

   function handleCreateKey() {
      openCredenza({
         children: (
            <Suspense
               fallback={
                  <div className="flex flex-col gap-4 p-6">
                     <Skeleton className="h-6 w-40" />
                     <Skeleton className="h-4 w-64" />
                     <Skeleton className="h-10 w-full mt-4" />
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-40 w-full" />
                  </div>
               }
            >
               <CreateKeyForm
                  onSuccess={(result) => {
                     closeCredenza();
                     openCredenza({
                        children: (
                           <KeyRevealDialog
                              label={result.label}
                              onClose={closeCredenza}
                              plaintextKey={result.plaintextKey}
                           />
                        ),
                     });
                  }}
               />
            </Suspense>
         ),
      });
   }

   return (
      <TooltipProvider>
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div>
                  <h1 className="text-2xl font-semibold font-serif">
                     Chaves de API pessoais
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                     Gerencie suas chaves de API pessoais para acesso direto à
                     API.
                  </p>
               </div>
               <Button onClick={handleCreateKey}>
                  <Plus className="size-4 mr-1" />
                  Criar chave
               </Button>
            </div>

            <KeysTable keys={keys} />
         </div>
      </TooltipProvider>
   );
}

function PersonalApiKeysPage() {
   return (
      <ErrorBoundary FallbackComponent={PersonalApiKeysErrorFallback}>
         <Suspense fallback={<PersonalApiKeysSkeleton />}>
            <PersonalApiKeysContent />
         </Suspense>
      </ErrorBoundary>
   );
}
