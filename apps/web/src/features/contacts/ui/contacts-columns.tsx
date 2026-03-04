import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

export type ContactRow = {
   id: string;
   name: string;
   type: "cliente" | "fornecedor" | "ambos";
   email: string | null;
   phone: string | null;
   document: string | null;
   documentType: "cpf" | "cnpj" | null;
};

const TYPE_LABELS: Record<ContactRow["type"], string> = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
};

const TYPE_VARIANTS: Record<
   ContactRow["type"],
   "default" | "secondary" | "outline"
> = {
   cliente: "default",
   fornecedor: "secondary",
   ambos: "outline",
};

export function buildContactColumns(): ColumnDef<ContactRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
         ),
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => (
            <Badge variant={TYPE_VARIANTS[row.original.type]}>
               {TYPE_LABELS[row.original.type]}
            </Badge>
         ),
      },
      {
         accessorKey: "document",
         header: "Documento",
         cell: ({ row }) => {
            const { document, documentType } = row.original;
            if (!document)
               return <span className="text-muted-foreground">—</span>;
            return (
               <span className="text-sm">
                  {documentType?.toUpperCase()} {document}
               </span>
            );
         },
      },
      {
         accessorKey: "email",
         header: "Email",
         cell: ({ row }) =>
            row.original.email ? (
               <span className="text-sm">{row.original.email}</span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
      {
         accessorKey: "phone",
         header: "Telefone",
         cell: ({ row }) =>
            row.original.phone ? (
               <span className="text-sm">{row.original.phone}</span>
            ) : (
               <span className="text-muted-foreground">—</span>
            ),
      },
   ];
}
