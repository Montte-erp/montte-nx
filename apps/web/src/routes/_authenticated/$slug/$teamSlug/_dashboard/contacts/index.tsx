import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { Users } from "lucide-react";
import { DefaultHeader } from "@/components/default-header";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { buildContactColumns } from "../-contacts/contacts-columns";
import { ContactsList } from "../-contacts/contacts-list";

type TypeFilter = "all" | "cliente" | "fornecedor" | "ambos";

const skeletonColumns = buildContactColumns();

const contactsSearchSchema = z.object({
   typeFilter: z
      .enum(["all", "cliente", "fornecedor", "ambos"])
      .catch("all")
      .default("all"),
   search: z.string().catch("").default(""),
});

const CONTACTS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Contatos",
   message: "Esta funcionalidade está em fase alpha.",
   ctaLabel: "Deixar feedback",
   stage: "alpha",
   icon: Users,
   bullets: [
      "Cadastre clientes e fornecedores",
      "Vincule contatos a transações e cobranças",
      "Seu feedback nos ajuda a melhorar",
   ],
};

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts/",
)({
   validateSearch: contactsSearchSchema,
   loaderDeps: ({ search: { typeFilter } }) => ({ typeFilter }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.contacts.getAll.queryOptions({
            input: deps.typeFilter !== "all" ? { type: deps.typeFilter } : {},
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: () => (
      <main className="flex h-full flex-col gap-4">
         <DataTableSkeleton columns={skeletonColumns} />
      </main>
   ),
   head: () => ({
      meta: [{ title: "Contatos — Montte" }],
   }),
   component: ContactsPage,
});

function ContactsPage() {
   const navigate = Route.useNavigate();
   const { typeFilter } = Route.useSearch();

   const handleTypeChange = useCallback(
      (nextType: string) => {
         navigate({
            search: (prev) => ({
               ...prev,
               typeFilter: nextType as TypeFilter,
               search: "",
            }),
            replace: true,
         });
      },
      [navigate],
   );

   return (
      <main className="flex h-full flex-col gap-4">
         <DefaultHeader
            description="Gerencie clientes e fornecedores"
            title="Contatos"
         />
         <EarlyAccessBanner template={CONTACTS_BANNER} />
         <Tabs onValueChange={handleTypeChange} value={typeFilter}>
            <TabsList>
               <TabsTrigger value="all">Todos</TabsTrigger>
               <TabsTrigger value="cliente">Clientes</TabsTrigger>
               <TabsTrigger value="fornecedor">Fornecedores</TabsTrigger>
               <TabsTrigger value="ambos">Ambos</TabsTrigger>
            </TabsList>
         </Tabs>
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<DataTableSkeleton columns={skeletonColumns} />}
               errorTitle="Erro ao carregar contatos"
            >
               <ContactsList />
            </QueryBoundary>
         </div>
      </main>
   );
}
