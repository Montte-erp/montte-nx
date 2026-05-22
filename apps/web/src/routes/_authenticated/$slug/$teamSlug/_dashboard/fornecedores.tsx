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
   initialSuppliers,
   makeSupplierDraft,
   type DemoSupplier,
   useDemoContracts,
   useDemoSuppliers,
} from "./-local-first-demo/demo-data";

const searchSchema = z.object({
   search: z.string().catch("").default(""),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/fornecedores",
)({
   validateSearch: searchSchema,
   head: () => ({ meta: [{ title: "Fornecedores — Montte" }] }),
   component: FornecedoresPage,
});

function FornecedoresPage() {
   const navigate = Route.useNavigate();
   const params = Route.useParams();
   const { search } = Route.useSearch();
   const [suppliers, setSuppliers] = useDemoSuppliers();
   const [contracts] = useDemoContracts();
   const data = suppliers ?? initialSuppliers;
   const filtered = useMemo(() => {
      const term = search.trim().toLocaleLowerCase();
      if (!term) return data;
      return data.filter((supplier) =>
         `${supplier.name} ${supplier.tradeName} ${supplier.document} ${supplier.email}`
            .toLocaleLowerCase()
            .includes(term),
      );
   }, [data, search]);

   function createSupplier() {
      setSuppliers((current) => [
         makeSupplierDraft(),
         ...(current ?? initialSuppliers),
      ]);
      toast.success("Fornecedor criado localmente.");
   }

   function updateSupplier(
      id: string,
      patch: Partial<DemoSupplier>,
   ): Promise<void> {
      if (patch.name !== undefined && patch.name.trim().length < 2) {
         toast.error("Informe o nome do fornecedor.");
         return Promise.resolve();
      }

      setSuppliers((current) => {
         const rows = current ?? initialSuppliers;
         return rows.map((supplier) =>
            supplier.id === id
               ? { ...supplier, ...patch, updatedAt: "2026-05-22" }
               : supplier,
         );
      });
      toast.success("Fornecedor salvo localmente.");
      return Promise.resolve();
   }

   function setStatus(id: string, status: DemoSupplier["status"]) {
      setSuppliers((current) =>
         (current ?? initialSuppliers).map((supplier) =>
            supplier.id === id
               ? { ...supplier, status, updatedAt: "2026-05-22" }
               : supplier,
         ),
      );
      toast.success(
         status === "active"
            ? "Fornecedor reativado."
            : "Fornecedor arquivado.",
      );
   }

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Cadastro separado para quem presta serviço, vende para a empresa ou gera contratos de despesa."
            title="Fornecedores"
         />
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar fornecedores"
                  onChange={(event) =>
                     navigate({
                        search: { search: event.target.value },
                        replace: true,
                     })
                  }
                  placeholder="Buscar fornecedores..."
                  value={search}
               />
               <Button
                  onClick={createSupplier}
                  size="icon-sm"
                  tooltip="Novo fornecedor"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo fornecedor</span>
               </Button>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Contratos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {filtered.map((supplier) => {
                        const contractCount = (contracts ?? []).filter(
                           (contract) => contract.supplierId === supplier.id,
                        ).length;
                        return (
                           <TableRow key={supplier.id}>
                              <TableCell className="min-w-56">
                                 <div className="flex flex-col gap-2">
                                    <InlineEditText
                                       ariaLabel="Razão social do fornecedor"
                                       onSave={(value) =>
                                          updateSupplier(supplier.id, {
                                             name: value,
                                          })
                                       }
                                       placeholder="Razão social"
                                       value={supplier.name}
                                    />
                                    <InlineEditText
                                       ariaLabel="Nome fantasia do fornecedor"
                                       className="text-xs text-muted-foreground"
                                       onSave={(value) =>
                                          updateSupplier(supplier.id, {
                                             tradeName: value,
                                          })
                                       }
                                       placeholder="Sem nome fantasia"
                                       value={supplier.tradeName}
                                    />
                                 </div>
                              </TableCell>
                              <TableCell className="w-28">
                                 <InlineEditSelect
                                    ariaLabel="Tipo de documento"
                                    onSave={(value) =>
                                       updateSupplier(supplier.id, {
                                          documentType:
                                             value === "cpf" ? "cpf" : "cnpj",
                                       })
                                    }
                                    options={[
                                       { value: "cnpj", label: "CNPJ" },
                                       { value: "cpf", label: "CPF" },
                                    ]}
                                    value={supplier.documentType}
                                 />
                              </TableCell>
                              <TableCell className="min-w-44">
                                 <InlineEditText
                                    ariaLabel="Documento do fornecedor"
                                    onSave={(value) =>
                                       updateSupplier(supplier.id, {
                                          document: value,
                                       })
                                    }
                                    placeholder="Não informado"
                                    value={supplier.document}
                                 />
                              </TableCell>
                              <TableCell className="min-w-52">
                                 <InlineEditText
                                    ariaLabel="E-mail do fornecedor"
                                    onSave={(value) =>
                                       updateSupplier(supplier.id, {
                                          email: value,
                                       })
                                    }
                                    placeholder="Não informado"
                                    value={supplier.email}
                                 />
                              </TableCell>
                              <TableCell className="w-32">
                                 <InlineEditSelect
                                    ariaLabel="Status do fornecedor"
                                    onSave={(value) =>
                                       updateSupplier(supplier.id, {
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
                                    value={supplier.status}
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
                                             supplierId: supplier.id,
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
                                             supplier.id,
                                             supplier.status === "active"
                                                ? "archived"
                                                : "active",
                                          )
                                       }
                                       size="icon-sm"
                                       tooltip={
                                          supplier.status === "active"
                                             ? "Arquivar fornecedor"
                                             : "Reativar fornecedor"
                                       }
                                       variant="ghost"
                                    >
                                       {supplier.status === "active" ? (
                                          <Archive />
                                       ) : (
                                          <RotateCcw />
                                       )}
                                       <span className="sr-only">
                                          {supplier.status === "active"
                                             ? "Arquivar fornecedor"
                                             : "Reativar fornecedor"}
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
