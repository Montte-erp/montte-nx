import { Button } from "@packages/ui/components/button";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, FilePlus2, Plus, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { z } from "zod";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { DefaultHeader } from "../-layout/default-header";
import {
   initialCustomers,
   makeCustomerDraft,
   type DemoCustomer,
   useDemoContracts,
   useDemoCustomers,
} from "./-local-first-demo/demo-data";

const searchSchema = z.object({
   search: z.string().catch("").default(""),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/clientes",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Clientes — Montte" }] }),
   component: ClientesPage,
});

function ClientesPage() {
   const navigate = Route.useNavigate();
   const params = Route.useParams();
   const { search } = Route.useSearch();
   const [customers, setCustomers] = useDemoCustomers();
   const [contracts] = useDemoContracts();
   const data = customers ?? initialCustomers;
   const filtered = useMemo(() => {
      const term = search.trim().toLocaleLowerCase();
      if (!term) return data;
      return data.filter((customer) =>
         `${customer.name} ${customer.tradeName} ${customer.document} ${customer.email}`
            .toLocaleLowerCase()
            .includes(term),
      );
   }, [data, search]);

   function createCustomer() {
      setCustomers((current) => [
         makeCustomerDraft(),
         ...(current ?? initialCustomers),
      ]);
      toast.success("Cliente criado localmente.");
   }

   function updateCustomer(
      id: string,
      patch: Partial<DemoCustomer>,
   ): Promise<void> {
      if (patch.name !== undefined && patch.name.trim().length < 2) {
         toast.error("Informe o nome do cliente.");
         return Promise.resolve();
      }

      setCustomers((current) => {
         const rows = current ?? initialCustomers;
         return rows.map((customer) =>
            customer.id === id
               ? { ...customer, ...patch, updatedAt: "2026-05-22" }
               : customer,
         );
      });
      toast.success("Cliente salvo localmente.");
      return Promise.resolve();
   }

   function setStatus(id: string, status: DemoCustomer["status"]) {
      setCustomers((current) =>
         (current ?? initialCustomers).map((customer) =>
            customer.id === id
               ? { ...customer, status, updatedAt: "2026-05-22" }
               : customer,
         ),
      );
      toast.success(
         status === "active" ? "Cliente reativado." : "Cliente arquivado.",
      );
   }

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Cadastro separado para quem compra da empresa e aparece nos contratos de receita."
            title="Clientes"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar clientes"
                  onChange={(event) =>
                     navigate({
                        search: { search: event.target.value },
                        replace: true,
                     })
                  }
                  placeholder="Buscar clientes..."
                  value={search}
               />
               <Button
                  onClick={createCustomer}
                  size="icon-sm"
                  tooltip="Novo cliente"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo cliente</span>
               </Button>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Contratos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {filtered.map((customer) => {
                        const contractCount = (contracts ?? []).filter(
                           (contract) => contract.customerId === customer.id,
                        ).length;
                        return (
                           <TableRow key={customer.id}>
                              <TableCell className="min-w-56">
                                 <div className="flex flex-col gap-2">
                                    <InlineEditText
                                       ariaLabel="Razão social do cliente"
                                       onSave={(value) =>
                                          updateCustomer(customer.id, {
                                             name: value,
                                          })
                                       }
                                       placeholder="Razão social"
                                       value={customer.name}
                                    />
                                    <InlineEditText
                                       ariaLabel="Nome fantasia do cliente"
                                       className="text-xs text-muted-foreground"
                                       onSave={(value) =>
                                          updateCustomer(customer.id, {
                                             tradeName: value,
                                          })
                                       }
                                       placeholder="Sem nome fantasia"
                                       value={customer.tradeName}
                                    />
                                 </div>
                              </TableCell>
                              <TableCell className="w-28">
                                 <InlineEditSelect
                                    ariaLabel="Tipo de documento"
                                    onSave={(value) =>
                                       updateCustomer(customer.id, {
                                          documentType:
                                             value === "cpf" ? "cpf" : "cnpj",
                                       })
                                    }
                                    options={[
                                       { value: "cnpj", label: "CNPJ" },
                                       { value: "cpf", label: "CPF" },
                                    ]}
                                    value={customer.documentType}
                                 />
                              </TableCell>
                              <TableCell className="min-w-44">
                                 <InlineEditText
                                    ariaLabel="Documento do cliente"
                                    onSave={(value) =>
                                       updateCustomer(customer.id, {
                                          document: value,
                                       })
                                    }
                                    placeholder="Não informado"
                                    value={customer.document}
                                 />
                              </TableCell>
                              <TableCell className="min-w-52">
                                 <InlineEditText
                                    ariaLabel="E-mail do cliente"
                                    onSave={(value) =>
                                       updateCustomer(customer.id, {
                                          email: value,
                                       })
                                    }
                                    placeholder="Não informado"
                                    value={customer.email}
                                 />
                              </TableCell>
                              <TableCell className="w-32">
                                 <InlineEditSelect
                                    ariaLabel="Status do cliente"
                                    onSave={(value) =>
                                       updateCustomer(customer.id, {
                                          status:
                                             value === "archived"
                                                ? "archived"
                                                : "active",
                                       })
                                    }
                                    options={[
                                       { value: "active", label: "Ativo" },
                                       {
                                          value: "archived",
                                          label: "Arquivado",
                                       },
                                    ]}
                                    value={customer.status}
                                 />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                 {contractCount}
                              </TableCell>
                              <TableCell>
                                 <div className="flex justify-end gap-2">
                                    <Button
                                       asChild
                                       size="icon-sm"
                                       tooltip="Criar contrato"
                                       variant="ghost"
                                    >
                                       <Link
                                          params={params}
                                          search={{
                                             customerId: customer.id,
                                          }}
                                          to="/$slug/$teamSlug/contratos"
                                       >
                                          <FilePlus2 />
                                          <span className="sr-only">
                                             Criar contrato
                                          </span>
                                       </Link>
                                    </Button>
                                    <Button
                                       onClick={() =>
                                          setStatus(
                                             customer.id,
                                             customer.status === "active"
                                                ? "archived"
                                                : "active",
                                          )
                                       }
                                       size="icon-sm"
                                       tooltip={
                                          customer.status === "active"
                                             ? "Arquivar cliente"
                                             : "Reativar cliente"
                                       }
                                       variant="ghost"
                                    >
                                       {customer.status === "active" ? (
                                          <Archive />
                                       ) : (
                                          <RotateCcw />
                                       )}
                                       <span className="sr-only">
                                          {customer.status === "active"
                                             ? "Arquivar cliente"
                                             : "Reativar cliente"}
                                       </span>
                                    </Button>
                                 </div>
                              </TableCell>
                           </TableRow>
                        );
                     })}
                  </TableBody>
               </Table>
            </ScrollArea>
         </div>
      </main>
   );
}
