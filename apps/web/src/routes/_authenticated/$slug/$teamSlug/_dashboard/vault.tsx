import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Label } from "@packages/ui/components/label";
import { Separator } from "@packages/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";
import {
   Archive,
   Building2,
   FileCheck2,
   FileText,
   Plus,
   ReceiptText,
   Search,
   Upload,
} from "lucide-react";
import { Fragment } from "react";
import { DefaultHeader } from "../-layout/default-header";
import { useCredenza } from "@/hooks/use-credenza";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/vault",
)({
   head: () => ({
      meta: [{ title: "Vault — Montte" }],
   }),
   component: VaultPage,
});

type VaultDocumentRow = {
   id: string;
   title: string;
   description: string;
   folder: string;
   status: string;
   updatedAt: string;
   icon: typeof FileText;
};

const vaultDocuments: VaultDocumentRow[] = [
   {
      id: "nfse-jacobina-0001",
      title: "NFS-e Jacobina · Junho/2026",
      description: "Documento fiscal emitido e armazenado automaticamente.",
      folder: "Fiscal",
      status: "Arquivado",
      updatedAt: "Hoje",
      icon: ReceiptText,
   },
   {
      id: "contrato-fornecedor-base",
      title: "Contrato de fornecedor · Modelo base",
      description: "Modelo operacional para anexar contratos recorrentes.",
      folder: "Contratos",
      status: "Pendente",
      updatedAt: "Ontem",
      icon: FileText,
   },
   {
      id: "cadastro-empresa",
      title: "Cadastro da empresa",
      description: "Documentos societários e comprovantes do espaço.",
      folder: "Empresa",
      status: "Organizado",
      updatedAt: "12 jun",
      icon: Building2,
   },
];

const vaultFolders = [
   { id: "all", label: "Todos os documentos", count: 24, icon: Archive },
   { id: "fiscal", label: "Fiscal", count: 8, icon: ReceiptText },
   { id: "contracts", label: "Contratos", count: 6, icon: FileText },
   { id: "company", label: "Empresa", count: 10, icon: Building2 },
];

function UploadDocumentCredenza() {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Novo documento</CredenzaTitle>
            <CredenzaDescription>
               Adicione um documento ao GED do Montte para organizar arquivos do
               espaço.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="flex flex-col gap-4">
            <div className="grid gap-2">
               <Label htmlFor="vault-document-title">Nome do documento</Label>
               <Input
                  id="vault-document-title"
                  placeholder="Ex.: Contrato de prestação de serviços"
               />
            </div>
            <div className="grid gap-2">
               <Label htmlFor="vault-document-folder">Pasta</Label>
               <Input id="vault-document-folder" placeholder="Ex.: Contratos" />
            </div>
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-8 text-center">
               <Upload className="size-5 text-muted-foreground" />
               <div className="text-sm font-medium">Enviar arquivo</div>
               <p className="max-w-sm text-sm text-muted-foreground">
                  PDF, XML, imagem ou documento. O upload será conectado ao
                  backend do GED na próxima etapa.
               </p>
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button disabled type="button">
               Salvar documento
            </Button>
         </CredenzaFooter>
      </>
   );
}

function FolderItem({ folder }: { folder: (typeof vaultFolders)[number] }) {
   const Icon = folder.icon;

   return (
      <Item size="sm" asChild>
         <li>
            <ItemMedia>
               <Icon className="size-4 text-muted-foreground" />
            </ItemMedia>
            <ItemContent>
               <ItemTitle>{folder.label}</ItemTitle>
            </ItemContent>
            <ItemActions>
               <span className="text-sm text-muted-foreground">
                  {folder.count}
               </span>
            </ItemActions>
         </li>
      </Item>
   );
}

function DocumentItem({ document }: { document: VaultDocumentRow }) {
   const Icon = document.icon;

   return (
      <Item asChild>
         <li>
            <ItemMedia variant="icon">
               <Icon className="text-muted-foreground" />
            </ItemMedia>
            <ItemContent>
               <ItemTitle>{document.title}</ItemTitle>
               <ItemDescription>{document.description}</ItemDescription>
               <ItemDescription>
                  {document.folder} · Atualizado {document.updatedAt}
               </ItemDescription>
            </ItemContent>
            <ItemActions>
               <Badge variant="outline">{document.status}</Badge>
               <Button size="sm" type="button" variant="outline">
                  Abrir
               </Button>
            </ItemActions>
         </li>
      </Item>
   );
}

function VaultFoldersPanel() {
   return (
      <aside className="flex flex-col gap-3 lg:w-64 lg:shrink-0">
         <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Pastas</h2>
            <p className="text-sm text-muted-foreground">
               Estrutura inicial do GED.
            </p>
         </div>
         <ItemGroup className="overflow-hidden rounded-lg border bg-card">
            {vaultFolders.map((folder, index) => (
               <Fragment key={folder.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <FolderItem folder={folder} />
               </Fragment>
            ))}
         </ItemGroup>
      </aside>
   );
}

function VaultDocumentsPanel() {
   const { openCredenza } = useCredenza();

   return (
      <section className="flex min-w-0 flex-1 flex-col gap-4">
         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
               <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
               <Input className="pl-9" placeholder="Buscar documentos..." />
            </div>
            <Button
               onClick={() =>
                  openCredenza({
                     className: "sm:max-w-lg",
                     renderChildren: () => <UploadDocumentCredenza />,
                  })
               }
               type="button"
            >
               <Plus className="size-4" />
               Novo documento
            </Button>
         </div>

         <ItemGroup className="overflow-hidden rounded-lg border bg-card">
            {vaultDocuments.map((document, index) => (
               <Fragment key={document.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <DocumentItem document={document} />
               </Fragment>
            ))}
         </ItemGroup>
      </section>
   );
}

function VaultSummaryPanel() {
   return (
      <aside className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
         <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
               <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
                  <FileCheck2 className="size-4 text-muted-foreground" />
               </div>
               <div>
                  <div className="font-medium">GED Montte</div>
                  <div className="text-sm text-muted-foreground">
                     24 documentos
                  </div>
               </div>
            </div>
            <Separator className="my-4" />
            <dl className="grid gap-3 text-sm">
               <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Fiscais</dt>
                  <dd className="font-medium">8</dd>
               </div>
               <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Contratos</dt>
                  <dd className="font-medium">6</dd>
               </div>
               <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Empresa</dt>
                  <dd className="font-medium">10</dd>
               </div>
            </dl>
         </div>

         <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            O Vault começa como cofre documental: emissão fiscal, anexos,
            contratos e documentos da empresa em um só lugar.
         </div>
      </aside>
   );
}

function VaultPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="GED do Montte para organizar documentos fiscais, contratos e anexos do espaço."
            title="Vault"
         />
         <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto lg:flex-row">
            <VaultFoldersPanel />
            <VaultDocumentsPanel />
            <VaultSummaryPanel />
         </div>
      </main>
   );
}
